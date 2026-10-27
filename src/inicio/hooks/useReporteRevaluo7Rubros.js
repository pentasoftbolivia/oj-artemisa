import { useState, useCallback } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useToast } from "@/hooks/use-toast";
import { LOGO_JPG_DATA_URL } from "@/lib/logoJpgBase64";
import {
  FECHA_REVALUO,
  REVALUO_7_RUBROS_HEADERS,
  formatRevaluoMoney,
  loadRevaluo7Rubros,
} from "../services/revaluo7RubrosService";

const LOGO_W = 32;
const LOGO_H = LOGO_W * (57 / 256);

const addLogo = (doc) => {
  try {
    doc.addImage(LOGO_JPG_DATA_URL, "JPEG", 14, 8, LOGO_W, LOGO_H);
  } catch {
    // El logo es opcional: si falla la carga, se genera el PDF sin logo.
  }
};

const formatError = (err) => {
  if (!err) return "Error desconocido";
  const code = err?.code ? `[${err.code}] ` : "";
  const message = err?.message || err?.details || err?.hint || err?.error_description;
  if (message) return `${code}${message}`;
  return `${code}${String(err)}`;
};

const fmtAnios = (value) => (value === null || value === undefined || value === "" ? "—" : String(value));

/**
 * REPORTE REVALUO 7 RUBROS (PDF).
 * Un PDF con una sección por rubro (7 secciones) y las mismas columnas:
 * N°, Código Activo, Descripción, Propuesta de descripción del Bien,
 * Rubro Contable, Valor en Libros, Nuevo Valor, Nueva vida Útil,
 * Estado del Bien, Observación y/o Recomendación, Fecha de Revalúo.
 */
export const useReporteRevaluo7Rubros = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    try {
      toast({ title: "Generando Revaluo 7 Rubros", description: "Cargando activos de revalúo..." });

      const { grupos, total, sinClasificar } = await loadRevaluo7Rubros();

      if (total === 0) {
        toast({
          title: "Sin datos",
          description: "No hay activos de revalúo en los 7 rubros para generar el reporte.",
          variant: "destructive",
        });
        return;
      }

      const omitidos = Object.values(sinClasificar ?? {}).reduce((sum, n) => sum + Number(n || 0), 0);
      if (omitidos > 0) {
        toast({
          title: "Activos sin clasificar",
          description: `${omitidos} activos del universo TODO REVALUO no coinciden con los 7 rubros y no se incluyeron.`,
          variant: "destructive",
        });
      }

      toast({ title: "Generando PDF", description: `Construyendo reporte con ${total} activos en 7 rubros...` });

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const tableWidth = 248;
      const sideMargin = Math.max(8, (pageWidth - tableWidth) / 2);

      grupos.forEach((grupo, index) => {
        if (index > 0) doc.addPage();

        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(0);
        doc.text("REVALUO 7 RUBROS - ÓRGANO JUDICIAL", pageWidth / 2, 16, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(
          `Activos revaluados: ${total}  |  Fecha de revalúo: ${FECHA_REVALUO}`,
          pageWidth / 2,
          21,
          { align: "center" }
        );

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(`${grupo.label} (${grupo.rows.length})`, pageWidth / 2, 27, { align: "center" });

        if (grupo.rows.length === 0) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.text("Sin registros en este rubro.", pageWidth / 2, 36, { align: "center" });
          return;
        }

        const body = grupo.rows.map((row) => [
          String(row.n),
          row.codigoActivo != null ? `OJ-02-${row.codigoActivo}` : "—",
          row.descripcion || "—",
          row.propuestaDescripcion || "",
          row.rubroContable || "—",
          formatRevaluoMoney(row.valorEnLibros),
          formatRevaluoMoney(row.nuevoValor),
          fmtAnios(row.nuevaVidaUtil),
          row.estadoBien || "—",
          row.observacion || "—",
          row.fechaRevaluo,
        ]);

        autoTable(doc, {
          startY: 31,
          head: [REVALUO_7_RUBROS_HEADERS],
          body,
          theme: "grid",
          styles: {
            font: "helvetica",
            fontSize: 5.8,
            cellPadding: 1,
            overflow: "linebreak",
            valign: "middle",
          },
          headStyles: {
            fillColor: [16, 70, 140],
            textColor: [255, 255, 255],
            halign: "center",
            fontStyle: "bold",
            fontSize: 5.8,
          },
          bodyStyles: { textColor: [30, 30, 30] },
          alternateRowStyles: { fillColor: [243, 247, 252] },
          columnStyles: {
            0: { cellWidth: 7, halign: "center" },
            1: { cellWidth: 18, halign: "center" },
            2: { cellWidth: 45, halign: "left" },
            3: { cellWidth: 40, halign: "left" },
            4: { cellWidth: 28, halign: "left" },
            5: { cellWidth: 16, halign: "right" },
            6: { cellWidth: 16, halign: "right" },
            7: { cellWidth: 10, halign: "center" },
            8: { cellWidth: 13, halign: "center" },
            9: { cellWidth: 40, halign: "left" },
            10: { cellWidth: 15, halign: "center" },
          },
          tableWidth,
          margin: { left: sideMargin, right: sideMargin, top: 31 },
        });
      });

      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addLogo(doc);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80);
        doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 7, { align: "center" });
      }

      doc.save(`Revaluo_7_Rubros_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast({ title: "Reporte generado", description: `Se exportaron ${total} activos en 7 rubros.` });
    } catch (err) {
      console.error("Error generando Revaluo 7 Rubros (PDF)", err);
      toast({
        title: "Error",
        description: `No se pudo generar el reporte: ${formatError(err)}`,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
