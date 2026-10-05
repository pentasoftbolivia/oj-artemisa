import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
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

  // Descarga con concurrencia limitada para no saturar la red
  const mapWithConcurrency = async (items, limit, fn) => {
    const results = new Array(items.length);
    let i = 0;
    const worker = async () => {
      while (i < items.length) {
        const idx = i++;
        results[idx] = await fn(items[idx], idx);
      }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
  };

  // Pre-carga las listas de fotos de todos los activos en paralelo (8 a la vez)
  // en lugar de una por una dentro del bucle.
  const allFotos = await mapWithConcurrency(
    activos,
    8,
    async (a, idx) => {
      try {
        const fotos = await fetchActivoImages(a.codigoActivo);
        if (onProgress) onProgress(idx + 1, activos.length);
        return fotos || [];
      } catch {
        if (onProgress) onProgress(idx + 1, activos.length);
        return [];
      }
    }
  );

  for (let idx = 0; idx < activos.length; idx++) {
    const a = activos[idx];

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

    let fotos = allFotos[idx] || [];

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

      // Descarga las imágenes en paralelo (6 a la vez) en lugar de una por una
      const base64List = await mapWithConcurrency(fotos, 6, (f) => urlToBase64(f.url));

      for (let fIdx = 0; fIdx < fotos.length; fIdx++) {
        if (col === 0) {
          // antes de cada fila, verificar que quepa la fila completa
          if (y + imgH + 8 > pageHeight - 10) {
            doc.addPage();
            y = 14;
            addLogo(doc);
          }
        }
        const base64 = base64List[fIdx];
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

export const generateRevaluoLotesPDFReport = async ({
  activos = [],
  filtrosResumen = "",
  worksheet = {},
  filePrefix = "REPORTE_LOTES_PDF",
  tituloReporte = "ACTIVOS REVALUADOS",
  numeroInicial = 1,
  totalProyecto = null,
  paginaInicial = 1,
  totalPaginasProyecto = null,
  dryRun = false,
  onProgress,
} = {}) => {
  if (!activos || activos.length === 0) return;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;
  // Correlativo del lote dentro del proyecto para que varios PDFs parezcan un solo proyecto
  const totalEnProyecto = totalProyecto ?? activos.length;
  const loteDesde = numeroInicial;
  const loteHasta = numeroInicial + activos.length - 1;

  addLogo(doc);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(tituloReporte, pageWidth / 2, 12, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Total proyecto: ${totalEnProyecto}  |  Lote del ${loteDesde} al ${loteHasta} (${activos.length})  |  Fecha: ${new Date().toLocaleString("es-BO")}`, pageWidth / 2, 18, { align: "center" });
  if (filtrosResumen) {
    const filterLines = doc.splitTextToSize(`Filtros: ${filtrosResumen}`, contentWidth);
    const filterToShow = filterLines.slice(0, 2);
    doc.setFontSize(7);
    doc.text(filterToShow, pageWidth / 2, 22, { align: "center" });
    doc.setDrawColor(200);
    doc.line(margin, 22 + filterToShow.length * 3.5, pageWidth - margin, 22 + filterToShow.length * 3.5);
  } else {
    doc.setDrawColor(200);
    doc.line(margin, 20, pageWidth - margin, 20);
  }

  let y = filtrosResumen ? 28 : 24;

  const checkPage = (needed = 40) => {
    if (y + needed > pageHeight - 15) {
      doc.addPage();
      y = 12;
      addLogo(doc);
    }
  };

  const mapWithConcurrency = async (items, limit, fn) => {
    const results = new Array(items.length);
    let i = 0;
    const worker = async () => {
      while (i < items.length) {
        const idx = i++;
        results[idx] = await fn(items[idx], idx);
      }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
  };

  const fmtBsPdf = (v) =>
    v === null || v === undefined || v === ""
      ? "—"
      : `Bs ${Number(v).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtNumPdf = (v) => (v === null || v === undefined || v === "" ? "—" : String(v));

  const allFotos = await mapWithConcurrency(activos, 8, async (a, idx) => {
    try {
      const fotos = await fetchActivoImages(a.codigoActivo);
      if (onProgress) onProgress(idx + 1, activos.length);
      return fotos || [];
    } catch {
      if (onProgress) onProgress(idx + 1, activos.length);
      return [];
    }
  });

  const rowKeyOfPdf = (a) =>
    String(a.codigoActivoInterno ?? a.codigoactivointerno ?? a.codigoActivo ?? a._codigoActivo ?? "");

  for (let idx = 0; idx < activos.length; idx++) {
    const a = activos[idx];
    const correlativo = numeroInicial + idx;
    const codigo = a._codigoActivo || (a.codigoActivo ? `OJ-02-${a.codigoActivo}` : "—");
    const estadoAltaBaja = getEstadoAltaBajaLabel(a.estado ?? a.estadoActivo);
    const wsRow = worksheet[rowKeyOfPdf(a)] || {};
    const calc = calcRowReport(a, wsRow);
    const ubic = resolveUbicacionParts(a);
    const ubicacionHeader =
      [ubic.ciudad, ubic.inmueble, ubic.nivel, ubic.ambiente].filter(Boolean).join(" / ") ||
      a._ubicacion ||
      "Sin ubicación";

    checkPage(60);

    const headerH = 14;
    doc.setFillColor(180, 53, 9);
    doc.setDrawColor(180, 53, 9);
    doc.rect(margin, y, contentWidth, headerH, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(`${correlativo}. Activo: ${codigo}`, margin + 2, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const direccionLines = doc.splitTextToSize(ubicacionHeader, contentWidth - 20);
    doc.text(`Ubicación: ${direccionLines[0]}`, margin + 2, y + 9.5);
    let extraHeaderH = 0;
    if (direccionLines.length > 1) {
      for (let d = 1; d < Math.min(direccionLines.length, 2); d++) {
        doc.text(direccionLines[d], margin + 16, y + 9.5 + d * 3.5);
        extraHeaderH += 3.5;
      }
      doc.rect(margin, y, contentWidth, headerH + extraHeaderH, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text(`${correlativo}. Activo: ${codigo}`, margin + 2, y + 5);
      doc.setFont("helvetica", "normal");
      doc.text(`Ubicación: ${direccionLines[0]}`, margin + 2, y + 9.5);
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
    const col1ValX = margin + 26;
    const col2X = margin + contentWidth / 2 + 2;
    const col2ValX = margin + contentWidth / 2 + 30;
    const lineH = 4;

    const drawTwoCols = (l1, v1, l2, v2) => {
      checkPage(lineH + 4);
      doc.setFont("helvetica", "bold");
      doc.text(l1, col1X, y);
      doc.setFont("helvetica", "normal");
      doc.text(String(v1).slice(0, 40), col1ValX, y);
      doc.setFont("helvetica", "bold");
      doc.text(l2, col2X, y);
      doc.setFont("helvetica", "normal");
      doc.text(String(v2).slice(0, 32), col2ValX, y);
      y += lineH + 1;
    };

    const drawFullWidth = (label, value) => {
      const maxW = contentWidth - 34;
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
    drawFullWidth("Descripción:", a.descripcionActivo ?? a.descripcionactivo ?? "—");
    drawTwoCols("Conservación:", a._estadoConservacion || "—", "Años x tipo:", fmtNumPdf(calc.vidaTipo));
    drawTwoCols("Responsable:", a._responsableName || "—", "Carnet:", a._carnet || "—");
    // Dibuja un recuadro con título que agrupa filas de 1-2 campos.
    // Cada fila es [[etiqueta, valor], [etiqueta, valor] | null].
    // Recuadro que nunca solapa letras: se deja aire antes del borde superior
    // y el borde inferior se calcula desde la última línea escrita.
    const BOX_GAP_BEFORE = 2;
    const BOX_PAD_BOTTOM = 2.5;
    const drawBoxedGroup = (title, rowPairs) => {
      const rowH = lineH + 2;
      const titleH = 6;
      checkPage(BOX_GAP_BEFORE + titleH + rowPairs.length * rowH + BOX_PAD_BOTTOM + 6);
      y += BOX_GAP_BEFORE; // aire entre el contenido previo y el recuadro
      const yStart = y;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text(title, col1X, y);
      y += titleH;
      rowPairs.forEach((pair) => {
        const [left, right] = pair;
        doc.setFont("helvetica", "bold");
        doc.text(left[0], col1X, y);
        doc.setFont("helvetica", "normal");
        doc.text(String(left[1]).slice(0, 38), col1ValX, y);
        if (right) {
          doc.setFont("helvetica", "bold");
          doc.text(right[0], col2X, y);
          doc.setFont("helvetica", "normal");
          doc.text(String(right[1]).slice(0, 30), col2ValX, y);
        }
        y += rowH;
      });
      const lastBaseline = y - rowH;
      const top = yStart - 4.2; // ~1.7mm sobre el título
      const bottom = lastBaseline + 1 + BOX_PAD_BOTTOM; // ~2.5mm bajo la última línea
      doc.setDrawColor(150);
      doc.rect(margin + 1, top, contentWidth - 2, bottom - top);
      y = bottom + 2; // aire después del recuadro
    };

    drawTwoCols("Ciudad:", ubic.ciudad || "—", "Inmueble:", ubic.inmueble || "—");
    drawTwoCols("Nivel:", ubic.nivel || "—", "Ambiente:", ubic.ambiente || "—");
    drawTwoCols("Estado:", estadoAltaBaja, "Años Asignados:", fmtNumPdf(calc.anios));
    drawBoxedGroup("COTIZACION", [
      [
        ["Cotización 1:", fmtBsPdf(wsRow.c1 ?? "")],
        ["Cotización 2:", fmtBsPdf(wsRow.c2 ?? "")],
      ],
      [["Cotización 3:", fmtBsPdf(wsRow.c3 ?? "")], null],
    ]);
    // Aire arriba y abajo de Promedio / Precio Revalúo respecto de los recuadros
    checkPage(lineH + 4 + 4);
    y += 2;
    drawTwoCols("Promedio:", fmtBsPdf(calc.promedio ?? ""), "Precio Revalúo:", fmtBsPdf(calc.precio ?? ""));
    y += 2;
    drawBoxedGroup("RESPALDOS", [
      [
        ["Respaldo 1:", String(wsRow.n1 || "—")],
        ["Respaldo 2:", String(wsRow.n2 || "—")],
      ],
      [["Respaldo 3:", String(wsRow.n3 || "—")], null],
    ]);
    drawBoxedGroup("FACTOR DE REVALUO DE ACUERDO A ESTADO", [
      [
        ["Bueno:", calc.fkey === "B" ? fmtNumPdf(calc.fr) : "—"],
        ["Regular:", calc.fkey === "R" ? fmtNumPdf(calc.fr) : "—"],
      ],
      [
        ["Malo:", calc.fkey === "M" ? fmtNumPdf(calc.fr) : "—"],
        ["Baja:", calc.fkey === "Ba" ? fmtNumPdf(calc.fr) : "—"],
      ],
    ]);
    drawBoxedGroup("FACTOR AÑOS ASIGNADOS DE ACUERDO A ESTADO", [
      [
        ["Bueno:", calc.fkey === "B" ? fmtNumPdf(calc.anios) : "—"],
        ["Regular:", calc.fkey === "R" ? fmtNumPdf(calc.anios) : "—"],
      ],
      [
        ["Malo:", calc.fkey === "M" ? fmtNumPdf(calc.anios) : "—"],
        ["Baja:", calc.fkey === "Ba" ? fmtNumPdf(calc.anios) : "—"],
      ],
    ]);
    drawFullWidth("Observaciones:", a.observaciones ? String(a.observaciones) : "—");

    y += 1;
    doc.setDrawColor(220);
    doc.line(margin, y, pageWidth - margin, y);
    y += 3;

    // FOTOGRAFIA al final de cada activo
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("FOTOGRAFIA:", margin + 2, y);
    y += 4;

    const fotos = allFotos[idx] || [];

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

      const base64List = await mapWithConcurrency(fotos, 6, (f) => urlToBase64(f.url));

      for (let fIdx = 0; fIdx < fotos.length; fIdx++) {
        if (col === 0 && y + imgH + 8 > pageHeight - 10) {
          doc.addPage();
          y = 14;
          addLogo(doc);
        }
        const base64 = base64List[fIdx];
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

    y += 1;
    if (idx < activos.length - 1) {
      doc.setDrawColor(230);
      doc.line(margin, y, pageWidth - margin, y);
      y += 3;
    }

    if (y > pageHeight - 20 && idx < activos.length - 1) {
      doc.addPage();
      y = 12;
      addLogo(doc);
    }
  }

  const totalPages = doc.getNumberOfPages();
  const totalPagesShown = totalPaginasProyecto ?? totalPages;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    if (i > 1) addLogo(doc);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text(`Página ${paginaInicial + i - 1} de ${totalPagesShown}  |  Lote ${loteDesde}-${loteHasta} de ${totalEnProyecto}  |  ACTIVOS REVALUADOS - Órgano Judicial`, pageWidth / 2, pageHeight - 6, { align: "center" });
  }

  if (!dryRun) {
    doc.save(`${filePrefix}_${new Date().toISOString().slice(0, 10)}.pdf`);
  }
  return { totalPages };
};

export const generateRevaluoFaltantesReport = async ({
  activos = [],
  filtrosResumen = "",
  worksheet = {},
  filePrefix = "REVALUO_ExcelSinFotos",
  numeroInicial = 1,
  tituloReporte = "ACTIVOS REVALUADOS",
} = {}) => {
  if (!activos || activos.length === 0) return;

  const { default: ExcelJS } = await import("exceljs");

  // Solo las columnas que se ven en la interfaz (tabla "Activos para Revalúo"), sin fotos.
  const columns = [
    { header: "N°", key: "n", width: 6 },
    { header: "Código Activo", key: "codigo", width: 16 },
    { header: "Rubro", key: "rubro", width: 24 },
    { header: "Tipo Rubro", key: "tipoRubro", width: 28 },
    { header: "Descripción", key: "descripcion", width: 45 },
    { header: "Conservación", key: "conservacion", width: 14 },
    { header: "Años x tipo", key: "anosTipo", width: 11 },
    { header: "Responsable", key: "responsable", width: 32 },
    { header: "Carnet", key: "ci", width: 14 },
    { header: "Estado", key: "estado", width: 10 },
    { header: "Ciudad", key: "ciudad", width: 22 },
    { header: "Inmueble", key: "inmueble", width: 30 },
    { header: "Nivel", key: "nivel", width: 22 },
    { header: "Ambiente", key: "ambiente", width: 30 },
    { header: "Cotización 1 (Bs)", key: "cot1", width: 15 },
    { header: "Cotización 2 (Bs)", key: "cot2", width: 15 },
    { header: "Cotización 3 (Bs)", key: "cot3", width: 15 },
    { header: "Promedio (Bs)", key: "promedio", width: 15 },
    { header: "N° Cot 1", key: "ncot1", width: 13 },
    { header: "N° Cot 2", key: "ncot2", width: 13 },
    { header: "N° Cot 3", key: "ncot3", width: 13 },
    { header: "F. Rev B", key: "frB", width: 11 },
    { header: "F. Rev R", key: "frR", width: 11 },
    { header: "F. Rev M", key: "frM", width: 11 },
    { header: "F. Rev Ba", key: "frBa", width: 11 },
    { header: "F. Años B", key: "faB", width: 11 },
    { header: "F. Años R", key: "faR", width: 11 },
    { header: "F. Años M", key: "faM", width: 11 },
    { header: "F. Años Ba", key: "faBa", width: 11 },
    { header: "Precio Revalúo (Bs)", key: "precio", width: 17 },
    { header: "Años Asignados", key: "anosAsig", width: 14 },
    { header: "Observaciones", key: "observaciones", width: 45 },
  ];

  const sorted = [...activos].sort((a, b) => {
    const numA = Number(a.codigoActivo);
    const numB = Number(b.codigoActivo);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return String(a.codigoActivo ?? "").localeCompare(String(b.codigoActivo ?? ""), "es", { numeric: true });
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Órgano Judicial";
  const wsExcel = wb.addWorksheet("SinFotos", {
    views: [{ state: "frozen", ySplit: filtrosResumen ? 4 : 3 }],
  });
  wsExcel.columns = columns;

  const totalCols = columns.length;
  wsExcel.mergeCells(1, 1, 1, totalCols);
  const titleCell = wsExcel.getCell(1, 1);
  titleCell.value = `${tituloReporte} - Total: ${sorted.length} | Fecha: ${new Date().toLocaleString("es-BO")}`;
  titleCell.font = { bold: true, size: 12 };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  wsExcel.getRow(1).height = 22;

  let headerRowNumber = 2;
  if (filtrosResumen) {
    wsExcel.mergeCells(2, 1, 2, totalCols);
    const filterCell = wsExcel.getCell(2, 1);
    filterCell.value = `Filtros: ${filtrosResumen}`;
    filterCell.font = { italic: true, size: 10 };
    filterCell.alignment = { horizontal: "center", vertical: "middle" };
    wsExcel.getRow(2).height = 18;
    headerRowNumber = 3;
  }

  // Fila de agrupadas; se dibuja tras estilar los encabezados
  const groupRowNumber = headerRowNumber;
  headerRowNumber += 1;

  const headerRow = wsExcel.getRow(headerRowNumber);
  columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB45309" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin" }, bottom: { style: "thin" },
      left: { style: "thin" }, right: { style: "thin" },
    };
  });
  headerRow.height = 32;
  wsExcel.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: headerRowNumber, column: totalCols },
  };

  // Dibuja la fila de cabeceras agrupadas (va encima de los encabezados)
  addGroupHeadersRow(wsExcel, columns, groupRowNumber, headerRowNumber, "FFB45309");

  const moneyFmt = "#,##0.00";
  const moneyKeys = new Set(["cot1", "cot2", "cot3", "promedio", "precio"]);

  sorted.forEach((a, idx) => {
    const rk = rowKeyOfReport(a);
    const wsRow = worksheet[rk] || {};
    const calc = calcRowReport(a, wsRow);
    const c1 = parseNumReport(wsRow.c1);
    const c2 = parseNumReport(wsRow.c2);
    const c3 = parseNumReport(wsRow.c3);
    const ubicPartsFaltantes = resolveUbicacionParts(a);

    const values = [
      numeroInicial + idx,
      a._codigoActivo || (a.codigoActivo ? `OJ-02-${a.codigoActivo}` : ""),
      String(a._rubro || ""),
      String(a._tipoRubro || ""),
      String(a.descripcionActivo ?? a.descripcionactivo ?? ""),
      String(a._estadoConservacion || ""),
      calc.vidaTipo ?? "",
      String(a._responsableName || ""),
      String(a._carnet || ""),
      getEstadoAltaBajaLabel(a.estado ?? a.estadoActivo),
      ubicPartsFaltantes.ciudad,
      ubicPartsFaltantes.inmueble,
      ubicPartsFaltantes.nivel,
      ubicPartsFaltantes.ambiente,
      c1 ?? "",
      c2 ?? "",
      c3 ?? "",
      calc.promedio ?? "",
      String(wsRow.n1 || ""),
      String(wsRow.n2 || ""),
      String(wsRow.n3 || ""),
      calc.fkey === "B" ? calc.fr ?? "" : "",
      calc.fkey === "R" ? calc.fr ?? "" : "",
      calc.fkey === "M" ? calc.fr ?? "" : "",
      calc.fkey === "Ba" ? calc.fr ?? "" : "",
      calc.fkey === "B" ? calc.anios ?? "" : "",
      calc.fkey === "R" ? calc.anios ?? "" : "",
      calc.fkey === "M" ? calc.anios ?? "" : "",
      calc.fkey === "Ba" ? calc.anios ?? "" : "",
      calc.precio ?? "",
      calc.anios ?? "",
      String(a.observaciones ?? ""),
    ];

    const row = wsExcel.getRow(headerRowNumber + 1 + idx);
    columns.forEach((col, i) => {
      const cell = row.getCell(i + 1);
      cell.value = values[i] ?? "";
      cell.alignment = { vertical: "middle", wrapText: true, horizontal: typeof values[i] === "number" ? "right" : "left" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFD9D9D9" } },
        bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
        left: { style: "thin", color: { argb: "FFD9D9D9" } },
        right: { style: "thin", color: { argb: "FFD9D9D9" } },
      };
      if (moneyKeys.has(col.key) && typeof values[i] === "number") cell.numFmt = moneyFmt;
    });
    row.height = 20;
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filePrefix}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
};

const rowKeyOfReport = (a) =>
  String(a.codigoActivoInterno ?? a.codigoactivointerno ?? a.codigoActivo ?? a._codigoActivo ?? "");

// Separa la ubicación en Ciudad / Inmueble / Nivel / Ambiente.
// Usa los campos ya resueltos (_ciudad, _inmueble, _nivel, _ambiente) y,
// como respaldo, divide el texto "Ciudad / Inmueble / Nivel / Ambiente".
const resolveUbicacionParts = (a) => {
  const fromFields = {
    ciudad: String(a._ciudad ?? "").trim(),
    inmueble: String(a._inmueble ?? "").trim(),
    nivel: String(a._nivel ?? "").trim(),
    ambiente: String(a._ambiente ?? "").trim(),
  };
  if (fromFields.ciudad || fromFields.inmueble || fromFields.nivel || fromFields.ambiente) {
    return fromFields;
  }
  const parts = String(a._ubicacion || "")
    .split("/")
    .map((s) => s.trim());
  return {
    ciudad: parts[0] && parts[0] !== "—" ? parts[0] : "",
    inmueble: parts[1] || "",
    nivel: parts[2] || "",
    ambiente: parts[3] || "",
  };
};

// Filas de cabecera agrupada sobre grupos de columnas del Excel.
const GROUP_HEADERS = [
  { title: "COTIZACION", from: "cot1", to: "cot3", fill: "FFFFC000" },
  { title: "RESPALDOS DE COTIZACION", from: "ncot1", to: "ncot3", fill: "FFF79646" },
  { title: "FACTOR DE REVALUO DE ACUERDO A ESTADO", from: "frB", to: "frBa", fill: "FFA9D18E" },
  { title: "FACTOR AÑOS ASIGNADOS DE ACUERDO A ESTADO", from: "faB", to: "faBa", fill: "FF8EAADB" },
];

const addGroupHeadersRow = (wsExcel, columns, groupRowNumber, headerRowNumber, headerFill) => {
  const covered = new Set();
  GROUP_HEADERS.forEach(({ title, from, to, fill }) => {
    const c1 = columns.findIndex((c) => c.key === from) + 1;
    const c2 = columns.findIndex((c) => c.key === to) + 1;
    if (c1 < 1 || c2 < 1 || c2 < c1) return;
    for (let c = c1; c <= c2; c++) covered.add(c);
    if (c2 > c1) wsExcel.mergeCells(groupRowNumber, c1, groupRowNumber, c2);
    const cell = wsExcel.getCell(groupRowNumber, c1);
    cell.value = title;
    cell.font = { bold: true, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin" }, bottom: { style: "thin" },
      left: { style: "thin" }, right: { style: "thin" },
    };
  });
  // Columnas sin cabecera agrupada: se fusionan verticalmente con su
  // encabezado para que queden del mismo alto que las agrupadas.
  columns.forEach((col, i) => {
    const c = i + 1;
    if (covered.has(c)) return;
    wsExcel.mergeCells(groupRowNumber, c, headerRowNumber, c);
    const cell = wsExcel.getCell(groupRowNumber, c);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerFill } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin" }, bottom: { style: "thin" },
      left: { style: "thin" }, right: { style: "thin" },
    };
  });
  wsExcel.getRow(groupRowNumber).height = 30;
};

const parseNumReport = (v) => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? null : n;
};

const factorKeyForReport = (a) => {
  const estado = String(a.estado ?? a.estadoActivo ?? "").trim().toUpperCase();
  if (estado === "0" || estado === "FALSE" || estado === "BAJA") return "Ba";
  const c = String(a._estadoConservacion || "").trim().toUpperCase();
  if (c.startsWith("R")) return "R";
  if (c.startsWith("M")) return "M";
  return "B";
};

const calcRowReport = (a, ws) => {
  const nums = [ws.c1, ws.c2, ws.c3].map(parseNumReport).filter((n) => n !== null);
  const promedio = nums.length > 0 ? nums.reduce((s, n) => s + n, 0) / nums.length : null;
  const fkey = factorKeyForReport(a);
  const vidaRaw = a._vidaUtil != null && String(a._vidaUtil).trim() !== "" ? Number(a._vidaUtil) : null;
  const vida = vidaRaw !== null && !isNaN(vidaRaw) ? vidaRaw : null;
  const vidaTipoRaw = a._vidaTipo != null && String(a._vidaTipo).trim() !== "" ? Number(a._vidaTipo) : null;
  const vidaTipo = vidaTipoRaw !== null && !isNaN(vidaTipoRaw) ? vidaTipoRaw : null;
  const consRaw = String(a.estadoconservacion ?? a.estadoConservacion ?? "").trim();
  const anios = consRaw === "" ? null : vida;
  const fr = promedio !== null && anios !== null ? promedio * anios : null;
  const precio = fr !== null && vidaTipo !== null && vidaTipo !== 0 ? fr / vidaTipo : null;
  return { promedio, precio, anios, fkey, fr, vida, vidaTipo };
};

export const generateRevaluoReportSimple = async ({
  activos = [],
  filtrosResumen = "",
  filePrefix = "REVALUO_Reporte",
  tituloReporte = "REPORTE DE ACTIVOS PARA REVALÚO",
  worksheet = {},
  photoCounts = {},
  onProgress,
} = {}) => {
  if (!activos || activos.length === 0) return;

  const { default: ExcelJS } = await import("exceljs");
  const sorted = [...activos].sort((a, b) => {
    const numA = Number(a.codigoActivo);
    const numB = Number(b.codigoActivo);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return String(a.codigoActivo ?? "").localeCompare(String(b.codigoActivo ?? ""), "es", { numeric: true });
  });

  const columns = [
    { header: "N°", key: "n", width: 6 },
    { header: "Código", key: "codigo", width: 16 },
    { header: "Rubro", key: "rubro", width: 24 },
    { header: "Tipo Rubro", key: "tipoRubro", width: 28 },
    { header: "Descripción", key: "descripcion", width: 45 },
    { header: "Conservación", key: "conservacion", width: 14 },
    { header: "Años x tipo", key: "anosTipo", width: 11 },
    { header: "Responsable", key: "responsable", width: 32 },
    { header: "CI", key: "ci", width: 14 },
    { header: "Ubicación", key: "ubicacion", width: 50 },
    { header: "Valor Actual", key: "valorActual", width: 16 },
    { header: "Estado", key: "estado", width: 10 },
    { header: "Inventariador", key: "inventariador", width: 28 },
    { header: "Marca/Material", key: "marca", width: 22 },
    { header: "Modelo", key: "modelo", width: 18 },
    { header: "Serie", key: "serie", width: 18 },
    { header: "Observaciones", key: "observaciones", width: 45 },
    { header: "Cotización 1 (Bs)", key: "cot1", width: 15 },
    { header: "Cotización 2 (Bs)", key: "cot2", width: 15 },
    { header: "Cotización 3 (Bs)", key: "cot3", width: 15 },
    { header: "Promedio (Bs)", key: "promedio", width: 15 },
    { header: "N° Cot 1", key: "ncot1", width: 13 },
    { header: "N° Cot 2", key: "ncot2", width: 13 },
    { header: "N° Cot 3", key: "ncot3", width: 13 },
    { header: "F. Rev B", key: "frB", width: 11 },
    { header: "F. Rev R", key: "frR", width: 11 },
    { header: "F. Rev M", key: "frM", width: 11 },
    { header: "F. Rev Ba", key: "frBa", width: 11 },
    { header: "F. Años B", key: "faB", width: 11 },
    { header: "F. Años R", key: "faR", width: 11 },
    { header: "F. Años M", key: "faM", width: 11 },
    { header: "F. Años Ba", key: "faBa", width: 11 },
    { header: "Precio Revalúo (Bs)", key: "precio", width: 17 },
    { header: "Años Asignados", key: "anosAsig", width: 14 },
    { header: "N° Fotos", key: "numFotos", width: 9 },
    { header: "Dirección Foto 1", key: "foto1", width: 50 },
    { header: "Dirección Foto 2", key: "foto2", width: 50 },
    { header: "Dirección Foto 3", key: "foto3", width: 50 },
    { header: "Todas las direcciones", key: "enlacesFotos", width: 60 },
  ];

  const wb = new ExcelJS.Workbook();
  wb.creator = "Órgano Judicial";
  const wsExcel = wb.addWorksheet("Revaluo", {
    views: [{ state: "frozen", ySplit: filtrosResumen ? 4 : 3 }],
  });
  wsExcel.columns = columns;

  const totalCols = columns.length;
  const titleText = `${tituloReporte} - Total: ${sorted.length} | Fecha: ${new Date().toLocaleString("es-BO")}`;
  wsExcel.mergeCells(1, 1, 1, totalCols);
  const titleCell = wsExcel.getCell(1, 1);
  titleCell.value = titleText;
  titleCell.font = { bold: true, size: 12 };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  wsExcel.getRow(1).height = 22;

  let headerRowNumber = 2;
  if (filtrosResumen) {
    wsExcel.mergeCells(2, 1, 2, totalCols);
    const filterCell = wsExcel.getCell(2, 1);
    filterCell.value = `Filtros: ${filtrosResumen}`;
    filterCell.font = { italic: true, size: 10 };
    filterCell.alignment = { horizontal: "center", vertical: "middle" };
    wsExcel.getRow(2).height = 18;
    headerRowNumber = 3;
  }

  // Fila de agrupadas; se dibuja tras estilar los encabezados
  const groupRowNumber = headerRowNumber;
  headerRowNumber += 1;

  const headerRow = wsExcel.getRow(headerRowNumber);
  columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin" }, bottom: { style: "thin" },
      left: { style: "thin" }, right: { style: "thin" },
    };
  });
  headerRow.height = 32;
  wsExcel.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: headerRowNumber, column: totalCols },
  };

  // Dibuja la fila de cabeceras agrupadas (va encima de los encabezados)
  addGroupHeadersRow(wsExcel, columns, groupRowNumber, headerRowNumber, "FF1F4E79");

  const moneyFmt = "#,##0.00";
  const moneyKeys = new Set(["valorActual", "cot1", "cot2", "cot3", "promedio", "precio"]);

  for (let idx = 0; idx < sorted.length; idx++) {
    const a = sorted[idx];
    const rk = rowKeyOfReport(a);
    const wsRow = worksheet[rk] || {};
    const calc = calcRowReport(a, wsRow);

    let fotos = [];
    try {
      fotos = (await fetchActivoImages(a.codigoActivo)) || [];
    } catch {
      fotos = [];
    }
    const numFotos =
      fotos.length > 0
        ? fotos.length
        : Number(photoCounts[String(a.codigoActivo)] ?? photoCounts[a.codigoActivo] ?? 0) || 0;
    const fotoUrls = (fotos || []).map((f) => f.url);
    const enlaces = fotoUrls.join("\n");

    const rowNumber = headerRowNumber + 1 + idx;
    const row = wsExcel.getRow(rowNumber);
    const c1 = parseNumReport(wsRow.c1);
    const c2 = parseNumReport(wsRow.c2);
    const c3 = parseNumReport(wsRow.c3);

    const values = [
      idx + 1,
      a._codigoActivo || (a.codigoActivo ? `OJ-02-${a.codigoActivo}` : ""),
      String(a._rubro || ""),
      String(a._tipoRubro || ""),
      String(a.descripcionActivo ?? a.descripcionactivo ?? ""),
      String(a._estadoConservacion || ""),
      calc.vidaTipo ?? "",
      String(a._responsableName || ""),
      String(a._carnet || ""),
      String(a._ubicacion || ""),
      a._valorRaw != null && String(a._valorRaw).trim() !== "" ? Number(a._valorRaw) : "",
      getEstadoAltaBajaLabel(a.estado ?? a.estadoActivo),
      String(a._inventariador || ""),
      String(a.marcaMaterial ?? a.marcamaterial ?? ""),
      String(a.modelo ?? ""),
      String(a.serie ?? ""),
      String(a.observaciones ?? ""),
      c1 ?? "",
      c2 ?? "",
      c3 ?? "",
      calc.promedio ?? "",
      String(wsRow.n1 || ""),
      String(wsRow.n2 || ""),
      String(wsRow.n3 || ""),
      calc.fkey === "B" ? calc.fr ?? "" : "",
      calc.fkey === "R" ? calc.fr ?? "" : "",
      calc.fkey === "M" ? calc.fr ?? "" : "",
      calc.fkey === "Ba" ? calc.fr ?? "" : "",
      calc.fkey === "B" ? calc.anios ?? "" : "",
      calc.fkey === "R" ? calc.anios ?? "" : "",
      calc.fkey === "M" ? calc.anios ?? "" : "",
      calc.fkey === "Ba" ? calc.anios ?? "" : "",
      calc.precio ?? "",
      calc.anios ?? "",
      numFotos,
      fotoUrls[0] || (numFotos === 0 ? "Sin fotos" : ""),
      fotoUrls[1] || "",
      fotoUrls[2] || "",
      enlaces || (numFotos === 0 ? "Sin fotos" : ""),
    ];
    const fotoKeys = new Set(["foto1", "foto2", "foto3", "enlacesFotos"]);
    columns.forEach((col, i) => {
      const cell = row.getCell(i + 1);
      const v = values[i] ?? "";
      if (fotoKeys.has(col.key) && typeof v === "string" && v.startsWith("http")) {
        cell.value = { text: v, hyperlink: v };
        cell.font = { color: { argb: "FF0563C1" }, underline: true, size: 9 };
      } else {
        cell.value = v;
      }
      cell.alignment = { vertical: "middle", wrapText: true, horizontal: typeof values[i] === "number" ? "right" : "left" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFD9D9D9" } },
        bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
        left: { style: "thin", color: { argb: "FFD9D9D9" } },
        right: { style: "thin", color: { argb: "FFD9D9D9" } },
      };
      if (moneyKeys.has(col.key) && typeof values[i] === "number") cell.numFmt = moneyFmt;
    });

    row.height = 20;

    if (onProgress) {
      try {
        onProgress(idx + 1, sorted.length);
      } catch (e) {
        void e;
      }
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filePrefix}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
};
