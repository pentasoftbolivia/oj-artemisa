import { useState, useCallback } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useToast } from "@/hooks/use-toast";
import { LOGO_JPG_DATA_URL } from "@/lib/logoJpgBase64";
import { fetchReclasificarPayload } from "../services/reclasificarRubroService";

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
  } catch { }
};

/**
 * Reporte RECLASIFICAR EL RUBRO (PDF).
 * Activos vigentes (ultimoregistro=1) cuyo tiporubroact usa un código
 * no canónico dentro de descripciones duplicadas en act_tiporubro.
 *Destino = código con más vigentes del mismo nombre.
 */
export const useReporteReclasificarRubro = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    try {
      toast({ title: "Generando Reclasificar el Rubro", description: "Cargando catálogos y vigentes..." });
      const { grupos, items, totalVigentes } = await fetchReclasificarPayload();

      if (items.length === 0) {
        toast({ title: "Sin datos", description: "No hay activos vigentes para reclasificar.", variant: "destructive" });
        return;
      }

      toast({ title: "Generando PDF", description: `Construyendo reporte con ${items.length} activos...` });

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "legal" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      addLogo(doc);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("RECLASIFICAR EL RUBRO - ÓRGANO JUDICIAL", pageWidth / 2, 16, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(
        `Vigentes: ${totalVigentes} | A reclasificar: ${items.length} | Descripciones ambiguas: ${grupos.length}`,
        pageWidth / 2, 21, { align: "center" }
      );

      let currentY = 26;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(16, 70, 140);
      doc.text("RESUMEN POR DESCRIPCIÓN (origen -> destino canónico por mayoría)", pageWidth / 2, currentY, { align: "center" });
      currentY += 4;
      const resumenBody = grupos.map((g, idx) => {
        const nReclas = g.detalle.filter((d) => !d.esDestino).reduce((s, d) => s + d.vigentes, 0);
        const origen = g.detalle.filter((d) => !d.esDestino).map((d) => `${d.tipo} (${d.rubro}: ${d.vigentes})`).join(" + ") || "—";
        return [String(idx + 1), g.descripcion, origen, `${g.canonico} (${g.rubroDestino})`, String(nReclas)];
      });
      const resumenW = 12 + 60 + 110 + 80 + 24;
      const resumenX = Math.max(6, (pageWidth - resumenW) / 2);
      autoTable(doc, {
        startY: currentY,
        head: [["#", "Tipo (descripción)", "Origen actual", "Destino sugerido", "A reclasificar"]],
        body: resumenBody,
        theme: "striped",
        tableWidth: resumenW,
        styles: { font: "helvetica", fontSize: 6.5, cellPadding: 1.4, halign: "center", valign: "middle", overflow: "linebreak" },
        headStyles: { fillColor: [16, 70, 140], textColor: [255, 255, 255], halign: "center", fontStyle: "bold", fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 12, halign: "center" },
          1: { cellWidth: 60, halign: "left" },
          2: { cellWidth: 110, halign: "left" },
          3: { cellWidth: 80, halign: "left" },
          4: { cellWidth: 24, halign: "center", fontStyle: "bold" },
        },
        margin: { left: resumenX, right: resumenX, top: 26 },
      });
      currentY = doc.lastAutoTable.finalY + 8;

      const head = [[
        "N°", "Código", "Descripción activo", "Tipo actual", "Rubro actual",
        "Tipo destino", "Rubro destino", "Ciudad", "Inmueble", "Nivel", "Ambiente", "EstadoInv",
      ]];
      const body = items.map((it, i) => ([
        String(i + 1),
        it.codigoActivo != null ? `OJ-02-${it.codigoActivo}` : "—",
        it.descripcionActivo,
        `${it.tipoActual} - ${it.tipoActualDesc}`,
        it.rubroActual,
        `${it.tipoDestino} - ${it.tipoDestinoDesc}`,
        it.rubroDestino,
        it.ciudad,
        it.inmueble,
        it.nivel,
        it.ambiente,
        it.estadoInventario,
      ]));

      if (currentY + 14 > pageHeight - 12) {
        doc.addPage();
        currentY = 26;
      }
      doc.setFillColor(16, 70, 140);
      doc.rect(6, currentY, pageWidth - 12, 8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(`ACTIVOS A RECLASIFICAR  —  ${items.length} activos (ordenados por rubro destino)`, 8, currentY + 5.2);
      currentY += 10;

      autoTable(doc, {
        startY: currentY,
        head,
        body,
        theme: "striped",
        styles: { font: "helvetica", fontSize: 6, cellPadding: 1.1, overflow: "linebreak", valign: "top" },
        headStyles: { fillColor: [16, 70, 140], textColor: [255, 255, 255], halign: "center", valign: "middle", fontSize: 6, fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 20, halign: "center" },
          2: { cellWidth: 42, halign: "left" },
          3: { cellWidth: 34, halign: "left" },
          4: { cellWidth: 34, halign: "left" },
          5: { cellWidth: 34, halign: "left" },
          6: { cellWidth: 34, halign: "left" },
          11: { cellWidth: 20, halign: "center" },
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
      doc.save(`Reclasificar_El_Rubro_${dateStr}.pdf`);
      toast({ title: "Reporte generado", description: `Se exportaron ${items.length} activos a reclasificar.` });
    } catch (err) {
      console.error("Error generando Reclasificar el Rubro", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
