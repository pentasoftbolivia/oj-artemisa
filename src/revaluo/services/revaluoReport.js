import { jsPDF } from "jspdf";
import { LOGO_JPG_DATA_URL } from "@/lib/logoJpgBase64";
import { fetchActivoImages } from "@/inventario/services/inventarioService";

const LOGO_W = 32;
const LOGO_H = LOGO_W * (57 / 256);

const addLogo = (doc) => {
  try {
    doc.addImage(LOGO_JPG_DATA_URL, "JPEG", 10, 6, LOGO_W, LOGO_H);
  } catch {}
};

const urlToBase64 = async (url) => {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

const getEstadoAltaBajaLabel = (v) => {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "1" || s === "TRUE" || s === "ALTA") return "Alta";
  if (s === "0" || s === "FALSE" || s === "BAJA") return "Baja";
  return s || "—";
};

export const generateRevaluoReportWithPhotos = async ({ activos = [], onProgress } = {}) => {
  if (!activos || activos.length === 0) return;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;

  // Header
  addLogo(doc);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("REPORTE DE ACTIVOS PARA REVALÚO", pageWidth / 2, 12, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Total activos: ${activos.length}  |  Fecha: ${new Date().toLocaleString("es-BO")}`, pageWidth / 2, 18, { align: "center" });
  doc.setDrawColor(200);
  doc.line(margin, 20, pageWidth - margin, 20);

  let y = 24;

  const checkPage = (needed = 40) => {
    if (y + needed > pageHeight - 15) {
      doc.addPage();
      y = 12;
      addLogo(doc);
    }
  };

  for (let idx = 0; idx < activos.length; idx++) {
    const a = activos[idx];
    if (onProgress) onProgress(idx + 1, activos.length);

    const codigo = a._codigoActivo || (a.codigoActivo ? `OJ-02-${a.codigoActivo}` : "—");
    const estadoAltaBaja = getEstadoAltaBajaLabel(a.estado ?? a.estadoActivo);
    const valor = a._valorActual || "—";

    checkPage(60);

    // Card header - separado Activo y Dirección con espacio
    const headerH = 14;
    doc.setFillColor(16, 185, 129);
    doc.setDrawColor(16, 185, 129);
    doc.rect(margin, y, contentWidth, headerH, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(`${idx + 1}. Activo: ${codigo}`, margin + 2, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const direccionText = a._ubicacion || "Sin ubicación";
    const direccionLines = doc.splitTextToSize(direccionText, contentWidth - 20);
    doc.text(`Dirección: ${direccionLines[0]}`, margin + 2, y + 9.5);
    let extraHeaderH = 0;
    if (direccionLines.length > 1) {
      // if dirección muy larga, extender header
      for (let d = 1; d < Math.min(direccionLines.length, 2); d++) {
        doc.text(direccionLines[d], margin + 16, y + 9.5 + d * 3.5);
        extraHeaderH += 3.5;
      }
      doc.rect(margin, y, contentWidth, headerH + extraHeaderH, "F");
      // re-draw text over extended rect
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text(`${idx + 1}. Activo: ${codigo}`, margin + 2, y + 5);
      doc.setFont("helvetica", "normal");
      doc.text(`Dirección: ${direccionLines[0]}`, margin + 2, y + 9.5);
      for (let d = 1; d < Math.min(direccionLines.length, 2); d++) {
        doc.text(direccionLines[d], margin + 16, y + 9.5 + d * 3.5);
      }
      doc.setTextColor(0, 0, 0);
    } else {
      doc.setTextColor(0, 0, 0);
    }
    y += headerH + extraHeaderH + 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);

    const col1X = margin + 2;
    const col1ValX = margin + 22;
    const col2X = margin + contentWidth / 2 + 2;
    const col2ValX = margin + contentWidth / 2 + 30;
    const lineH = 4;

    const drawTwoCols = (l1, v1, l2, v2) => {
      checkPage(lineH + 4);
      doc.setFont("helvetica", "bold");
      doc.text(l1, col1X, y);
      doc.setFont("helvetica", "normal");
      doc.text(String(v1).slice(0, 45), col1ValX, y);
      doc.setFont("helvetica", "bold");
      doc.text(l2, col2X, y);
      doc.setFont("helvetica", "normal");
      doc.text(String(v2).slice(0, 35), col2ValX, y);
      y += lineH + 1;
    };

    const drawFullWidth = (label, value) => {
      const maxW = contentWidth - 30;
      const lines = doc.splitTextToSize(String(value || "—"), maxW);
      const needed = 4 + lines.length * 3.5;
      checkPage(needed + 2);
      doc.setFont("helvetica", "bold");
      doc.text(label, col1X, y);
      doc.setFont("helvetica", "normal");
      doc.text(lines, col1ValX, y);
      y += lines.length * 3.5 + 1.5;
    };

    drawTwoCols("Rubro:", a._rubro || "—", "Tipo Rubro:", a._tipoRubro || "—");
    drawFullWidth("Descripción:", a.descripcionActivo || "—");
    drawTwoCols("Responsable:", a._responsableName || "—", "Carnet:", a._carnet || "—");
    drawTwoCols("Inventariador:", a._inventariador || "—", "Valor Actual:", valor);
    drawTwoCols("Estado Cons.:", a._estadoConservacion || "—", "Estado:", estadoAltaBaja);
    drawFullWidth("Observaciones:", a.observaciones ? String(a.observaciones) : "—");

    y += 1;
    doc.setDrawColor(220);
    doc.line(margin, y, pageWidth - margin, y);
    y += 3;

    // Fotos - mantiene orden inmediatamente debajo de Observaciones sin saltos
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("Fotos:", margin + 2, y);
    y += 4;

    let fotos = [];
    try {
      fotos = await fetchActivoImages(a.codigoActivo);
    } catch {
      fotos = [];
    }

    if (!fotos || fotos.length === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(120);
      doc.text("Sin fotos registradas", margin + 2, y);
      doc.setTextColor(0);
      y += 5;
    } else {
      const imgW = 38;
      const imgH = 28;
      const gap = 2;
      const perRow = Math.floor(contentWidth / (imgW + gap));
      let col = 0;

      for (let fIdx = 0; fIdx < fotos.length; fIdx++) {
        if (col === 0) {
          // antes de cada fila, verificar que quepa la fila completa
          if (y + imgH + 8 > pageHeight - 10) {
            doc.addPage();
            y = 14;
            addLogo(doc);
          }
        }
        const base64 = await urlToBase64(fotos[fIdx].url);
        const x = margin + 2 + col * (imgW + gap);
        if (base64) {
          try {
            const fmt = fotos[fIdx].name.toLowerCase().endsWith(".png") ? "PNG" : "JPEG";
            doc.addImage(base64, fmt, x, y, imgW, imgH);
          } catch {
            doc.setDrawColor(200);
            doc.rect(x, y, imgW, imgH);
            doc.setFontSize(5);
            doc.text("Error imagen", x + 2, y + 5);
          }
        } else {
          doc.setDrawColor(200);
          doc.rect(x, y, imgW, imgH);
        }
        col++;
        if (col >= perRow) {
          col = 0;
          y += imgH + 2;
        }
      }
      if (col !== 0) y += imgH + 2;
      // contador debajo de la última fila de fotos, sin salto extra
      if (y + 6 > pageHeight - 10) {
        doc.addPage();
        y = 14;
        addLogo(doc);
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(100);
      doc.text(`${fotos.length} foto(s)`, margin + 2, y);
      doc.setTextColor(0);
      y += 5;
    }

    // separador
    y += 1;
    if (idx < activos.length - 1) {
      doc.setDrawColor(230);
      doc.line(margin, y, pageWidth - margin, y);
      y += 3;
    }

    // paginación footer will be added at end
    if (y > pageHeight - 20 && idx < activos.length - 1) {
      doc.addPage();
      y = 12;
      addLogo(doc);
    }
  }

  // footer paginación
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    if (i > 1) addLogo(doc);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text(`Página ${i} de ${totalPages}  |  REVALUO - Órgano Judicial`, pageWidth / 2, pageHeight - 6, { align: "center" });
  }

  doc.save(`REVALUO_Reporte_Fotos_${new Date().toISOString().slice(0, 10)}.pdf`);
};
