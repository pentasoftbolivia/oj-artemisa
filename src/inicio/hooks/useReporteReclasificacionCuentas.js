import { useState, useCallback } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useToast } from "@/hooks/use-toast";
import { LOGO_JPG_DATA_URL } from "@/lib/logoJpgBase64";
import { DEPRECIACION_HEADERS, fetchReclasificacionCuentas } from "../services/reclasificacionCuentasService";

const formatError = (err) => {
  if (!err) return "Error desconocido";
  const code = err?.code ? `[${err.code}] ` : "";
  const message = err?.message || err?.details || err?.hint || err?.error_description;
  if (message) return `${code}${message}`;
  try {
    const str = JSON.stringify(err);
    return str && str !== "{}" ? `${code}${str}` : `${code}${String(err)}`;
  } catch {
    return `${code}${String(err)}`;
  }
};

const LOGO_W = 48;
const LOGO_H = LOGO_W * (57 / 256);
const addLogo = (doc) => {
  try {
    doc.addImage(LOGO_JPG_DATA_URL, "JPEG", 14, 8, LOGO_W, LOGO_H);
  } catch {
    // El logo es opcional.
  }
};

const display = (v) => {
  const value = String(v ?? "").replace(/\s+/g, " ").trim();
  return value || "—";
};

const formatDepreciacion = (value, depIndex, decimals = 4) => {
  if (value === null || value === undefined || String(value).trim() === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const digits = depIndex === 5 ? 8 : decimals;
  return n.toLocaleString("es-BO", { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

/**
 * Reporte RECLASIFICACION DE CUENTAS (PDF).
 * Lee public/Reclasificar.xlsx y reproduce su estructura Resumen + Detalle.
 * Al detalle se le quitan las columnas Código Interno, Tipo Actual y Tipo Destino.
 */
export const useReporteReclasificacionCuentas = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    try {
      toast({ title: "Generando Reclasificación de Cuentas", description: "Leyendo Reclasificar.xlsx..." });
      const { resumen, detalle } = await fetchReclasificacionCuentas();

      if (!detalle.rows.length) {
        toast({ title: "Sin datos", description: "El archivo no contiene activos para reclasificar.", variant: "destructive" });
        return;
      }

      toast({ title: "Generando PDF", description: `Construyendo reporte con ${detalle.rows.length} activos...` });

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "legal" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      addLogo(doc);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("RECLASIFICACION DE CUENTAS - ÓRGANO JUDICIAL", pageWidth / 2, 16, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(resumen.meta[0] || `A reclasificar: ${detalle.rows.length}`, pageWidth / 2, 21, { align: "center" });

      let currentY = 26;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(16, 70, 140);
      doc.text("RESUMEN POR DESCRIPCIÓN (origen -> destino canónico por mayoría)", pageWidth / 2, currentY, { align: "center" });
      currentY += 4;

      const resumenDepStart = resumen.headers.length - DEPRECIACION_HEADERS.length;
      const resumenBody = resumen.rows.map((row) =>
        row.map((value, index) =>
          index < resumenDepStart ? display(value) : formatDepreciacion(value, index - resumenDepStart, 2)
        )
      );
      const resumenW = 6 + 38 + 74 + 46 + 11 + DEPRECIACION_HEADERS.length * 11;
      const resumenX = Math.max(6, (pageWidth - resumenW) / 2);
      autoTable(doc, {
        startY: currentY,
        head: [resumen.headers],
        body: resumenBody,
        theme: "striped",
        tableWidth: resumenW,
        styles: { font: "helvetica", fontSize: 4.8, cellPadding: 1, halign: "center", valign: "middle", overflow: "linebreak" },
        headStyles: { fillColor: [16, 70, 140], textColor: [255, 255, 255], halign: "center", fontStyle: "bold", fontSize: 5.3 },
        columnStyles: {
          0: { cellWidth: 6, halign: "center" },
          1: { cellWidth: 38, halign: "left" },
          2: { cellWidth: 74, halign: "left" },
          3: { cellWidth: 46, halign: "left" },
          4: { cellWidth: 11, halign: "center", fontStyle: "bold" },
          5: { cellWidth: 11, halign: "right" },
          6: { cellWidth: 11, halign: "right" },
          7: { cellWidth: 11, halign: "right" },
          8: { cellWidth: 11, halign: "right" },
          9: { cellWidth: 11, halign: "right" },
          10: { cellWidth: 11, halign: "right" },
          11: { cellWidth: 11, halign: "right" },
          12: { cellWidth: 11, halign: "right" },
          13: { cellWidth: 11, halign: "right" },
          14: { cellWidth: 11, halign: "right" },
          15: { cellWidth: 11, halign: "right" },
          16: { cellWidth: 11, halign: "right" },
        },
        margin: { left: resumenX, right: resumenX, top: 26 },
      });
      currentY = doc.lastAutoTable.finalY + 8;

      if (currentY + 14 > pageHeight - 12) {
        doc.addPage();
        currentY = 26;
      }
      doc.setFillColor(16, 70, 140);
      doc.rect(6, currentY, pageWidth - 12, 8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(`ACTIVOS A RECLASIFICAR  —  ${detalle.rows.length} activos`, 8, currentY + 5.2);
      currentY += 10;

      const depStart = detalle.headers.length - DEPRECIACION_HEADERS.length;
      const detailBody = detalle.rows.map((row) =>
        row.map((value, index) =>
          index < depStart ? display(value) : formatDepreciacion(value, index - depStart)
        )
      );

      autoTable(doc, {
        startY: currentY,
        head: [detalle.headers],
        body: detailBody,
        theme: "striped",
        styles: { font: "helvetica", fontSize: 5.2, cellPadding: 0.8, overflow: "linebreak", valign: "top" },
        headStyles: { fillColor: [16, 70, 140], textColor: [255, 255, 255], halign: "center", valign: "middle", fontSize: 5.2, fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 7, halign: "center" },
          1: { cellWidth: 16, halign: "center" },
          2: { cellWidth: 37, halign: "left" },
          3: { cellWidth: 18, halign: "left" },
          4: { cellWidth: 20, halign: "left" },
          5: { cellWidth: 18, halign: "left" },
          6: { cellWidth: 20, halign: "left" },
          7: { cellWidth: 13, halign: "left" },
          8: { cellWidth: 20, halign: "left" },
          9: { cellWidth: 10, halign: "left" },
          10: { cellWidth: 18, halign: "left" },
          11: { cellWidth: 11, halign: "right" },
          12: { cellWidth: 11, halign: "right" },
          13: { cellWidth: 10, halign: "right" },
          14: { cellWidth: 11, halign: "right" },
          15: { cellWidth: 11, halign: "right" },
          16: { cellWidth: 9, halign: "right" },
          17: { cellWidth: 10, halign: "right" },
          18: { cellWidth: 12, halign: "right" },
          19: { cellWidth: 10, halign: "right" },
          20: { cellWidth: 13, halign: "right" },
          21: { cellWidth: 10, halign: "right" },
          22: { cellWidth: 10, halign: "right" },
        },
        margin: { left: 6, right: 6, top: 26 },
      });

      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        if (i > 1) addLogo(doc);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80);
        doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 7, { align: "center" });
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      doc.save(`Reclasificacion_De_Cuentas_${dateStr}.pdf`);
      toast({ title: "Reporte generado", description: `Se exportaron ${detalle.rows.length} activos a reclasificar.` });
    } catch (err) {
      console.error("Error generando Reclasificación de Cuentas", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
