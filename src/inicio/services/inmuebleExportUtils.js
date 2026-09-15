import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { LOGO_JPG_DATA_URL } from "@/lib/logoJpgBase64";

const LOGO_W = 48;
const LOGO_H = LOGO_W * (57 / 256);
const addLogo = (doc) => {
  try {
    doc.addImage(LOGO_JPG_DATA_URL, "JPEG", 14, 8, LOGO_W, LOGO_H);
  } catch {
    // ignore logo errors
  }
};

/**
 * Genera y descarga un reporte en PDF para los activos de un inmueble.
 */
export const exportInmueblePdf = ({
  title = "ACTIVOS INVENTARIADOS",
  items = [],
  ciudadName = "Todas",
  inmuebleName = "Todos",
  displayName = "",
  mapActivoRow,
  fileNamePrefix = "Activos_Inmueble",
  headerColor = [37, 99, 235],
  getUbicacionParts,
}) => {
  if (!items || items.length === 0) return;

  // Ordenar ascendente por INMUEBLE si se provee getUbicacionParts (consistente con Excel 10 cols)
  let sortedItems = items;
  if (typeof getUbicacionParts === "function" && items.length > 1) {
    sortedItems = [...items].sort((a, b) => {
      const codeA = String(a.codigoAmbiente ?? a.codigoambiente ?? "").trim();
      const codeB = String(b.codigoAmbiente ?? b.codigoambiente ?? "").trim();
      const partsA = getUbicacionParts(codeA) || [];
      const partsB = getUbicacionParts(codeB) || [];
      // parts: [Ciudad, Inmueble, Nivel, Ambiente]
      const inmA = String(partsA[1] ?? "").trim();
      const inmB = String(partsB[1] ?? "").trim();
      const cmp = inmA.localeCompare(inmB, "es", { sensitivity: "base", numeric: true });
      if (cmp !== 0) return cmp;
      const ciuCmp = String(partsA[0] ?? "").localeCompare(String(partsB[0] ?? ""), "es", { sensitivity: "base", numeric: true });
      if (ciuCmp !== 0) return ciuCmp;
      const nivCmp = String(partsA[2] ?? "").localeCompare(String(partsB[2] ?? ""), "es", { sensitivity: "base", numeric: true });
      if (nivCmp !== 0) return nivCmp;
      const ambCmp = String(partsA[3] ?? "").localeCompare(String(partsB[3] ?? ""), "es", { sensitivity: "base", numeric: true });
      if (ambCmp !== 0) return ambCmp;
      return String(a.codigoactivo ?? a.codigoActivo ?? "").localeCompare(String(b.codigoactivo ?? b.codigoActivo ?? ""), "es", { numeric: true });
    });
  }

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  addLogo(doc);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.text(title, pageWidth / 2, 15, { align: "center" });

  doc.setFontSize(9);

  const drawCenteredBoldLabel = (label, value, xCenter, y) => {
    doc.setFont("helvetica", "bold");
    const labelWidth = doc.getTextWidth(label);
    doc.setFont("helvetica", "normal");
    const valueWidth = doc.getTextWidth(value);
    const totalWidth = labelWidth + valueWidth;
    const startX = xCenter - totalWidth / 2;
    doc.setFont("helvetica", "bold");
    doc.text(label, startX, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, startX + labelWidth, y);
  };

  drawCenteredBoldLabel("CIUDAD: ", `${ciudadName || "Todas"}`, pageWidth / 4, 21);
  drawCenteredBoldLabel("INMUEBLE: ", `${inmuebleName || "Todos"}`, (pageWidth * 3) / 4, 21);

  let startY;
  if (displayName) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`INVENTARIADOR: ${displayName}`, pageWidth / 2, 25, { align: "center" });
    doc.setFontSize(8);
    doc.text(`Total de activos: ${items.length}`, pageWidth / 2, 29, { align: "center" });
    startY = 32;
  } else {
    doc.setFontSize(8);
    doc.text(`Total de activos: ${items.length}`, pageWidth / 2, 25, { align: "center" });
    startY = 28;
  }

  const body = sortedItems.map(mapActivoRow);
  const isPendientesPdf = body.length > 0 && body[0].length === 9;

  autoTable(doc, {
    startY,
    head: isPendientesPdf
      ? [["Código", "Rubro", "Tipo Rubro", "Descripción", "Ambiente", "Responsable", "CI Responsable", "Estado Inventario", "Usuario Inventario"]]
      : [["Código", "Rubro", "Tipo Rubro", "Descripción", "Ambiente", "Responsable", "CI Responsable"]],
    body,
    theme: "striped",
    styles: { font: "helvetica", fontSize: isPendientesPdf ? 6 : 7, cellPadding: 1.2, overflow: "linebreak" },
    headStyles: { fillColor: headerColor, textColor: [255, 255, 255], halign: "center" },
    columnStyles: isPendientesPdf
      ? {
          0: { cellWidth: 22 },
          1: { cellWidth: 24 },
          2: { cellWidth: 24 },
          3: { cellWidth: "auto" },
          4: { cellWidth: 32 },
          5: { cellWidth: 28 },
          6: { cellWidth: 18, halign: "center" },
          7: { cellWidth: 22, halign: "center" },
          8: { cellWidth: 32 },
        }
      : {
          0: { cellWidth: 28 },
          1: { cellWidth: 30 },
          2: { cellWidth: 30 },
          3: { cellWidth: "auto" },
          4: { cellWidth: 45 },
          5: { cellWidth: 38 },
          6: { cellWidth: 22, halign: "center" },
        },
    margin: { left: 14, right: 14 },
  });

  const pageHeight = doc.internal.pageSize.getHeight();
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    // logo en cada página
    if (i > 1) addLogo(doc);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: "center" });
  }

  const safeInmueble = (inmuebleName || "Inmueble").replace(/[^a-zA-Z0-9]+/g, "_");
  const safeUser = displayName ? `_${displayName.replace(/[^a-zA-Z0-9]+/g, "_")}` : "";
  doc.save(`${fileNamePrefix}_${safeInmueble}${safeUser}.pdf`);
};

/**
 * Genera y descarga un reporte PDF de transferencias para activos inventariados.
 * Columnas: Código Activo | Persona Origen | Ubicación Origen | Persona Destino | Ubicación Destino
 */
export const exportTransferenciasPdf = ({
  items = [],
  ciudadName = "Todas",
  inmuebleName = "Todos",
  fileNamePrefix = "Transferencias_Inventariados",
  headerColor = [37, 99, 235],
}) => {
  if (!items || items.length === 0) return;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  addLogo(doc);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.text("TRANSFERENCIAS DE ACTIVOS INVENTARIADOS", pageWidth / 2, 15, { align: "center" });

  doc.setFontSize(9);
  const drawCenteredBoldLabel = (label, value, xCenter, y) => {
    doc.setFont("helvetica", "bold");
    const labelWidth = doc.getTextWidth(label);
    doc.setFont("helvetica", "normal");
    const valueWidth = doc.getTextWidth(value);
    const totalWidth = labelWidth + valueWidth;
    const startX = xCenter - totalWidth / 2;
    doc.setFont("helvetica", "bold");
    doc.text(label, startX, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, startX + labelWidth, y);
  };

  drawCenteredBoldLabel("CIUDAD: ", `${ciudadName || "Todas"}`, pageWidth / 4, 21);
  drawCenteredBoldLabel("INMUEBLE: ", `${inmuebleName || "Todos"}`, (pageWidth * 3) / 4, 21);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Total transferencias: ${items.length}`, pageWidth / 2, 25, { align: "center" });
  const startY = 28;

  // items filtrados: solo con hasTransferencia=true, orden ascendente por código
  const body = items.map((r, idx) => [
    idx + 1,
    r.codigoActivo || "—",
    r.responsableInicialNombre ? `${r.responsableInicialNombre}\n(${r.responsableInicialCi || "—"})` : (r.responsableInicialCi || "—"),
    r.ubicacionInicial || "—",
    r.responsableFinalNombre ? `${r.responsableFinalNombre}\n(${r.responsableFinalCi || "—"})` : (r.responsableFinalCi || "—"),
    r.ubicacionFinal || "—",
  ]);

  autoTable(doc, {
    startY,
    head: [["N°", "CÓDIGO ACTIVO", "PERSONA ORIGEN\n(Nombre / CI)", "UBICACIÓN ORIGEN", "PERSONA DESTINO\n(Nombre / CI)", "UBICACIÓN DESTINO"]],
    body,
    theme: "striped",
    styles: { font: "helvetica", fontSize: 6.5, cellPadding: 1.2, overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: headerColor, textColor: [255, 255, 255], halign: "center", valign: "middle", fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 26, halign: "center", fontStyle: "bold" },
      2: { cellWidth: 42, halign: "left" },
      3: { cellWidth: 58, halign: "left" },
      4: { cellWidth: 42, halign: "left" },
      5: { cellWidth: 58, halign: "left" },
    },
    margin: { left: 14, right: 14 },
  });

  const pageHeight = doc.internal.pageSize.getHeight();
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    if (i > 1) addLogo(doc);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: "center" });
  }

  const safeInmueble = (inmuebleName || "Inmueble").replace(/[^a-zA-Z0-9]+/g, "_");
  doc.save(`${fileNamePrefix}_${safeInmueble}.pdf`);
};

/**
 * Genera y descarga un reporte Excel (.xlsx) para los activos de un inmueble.
 * Soporta layouts:
 * - 7 columnas legacy: ["Código","Rubro","Tipo Rubro","Descripción","Ambiente","Responsable","CI Responsable"]
 * - 9 columnas pendientes: ["Código","Rubro","Tipo Rubro","Descripción","Ambiente","Responsable","CI Responsable","Estado Inventario","Usuario Inventario"]
 * - 10 columnas con ubicación desglosada: ["Código","Rubro","Tipo Rubro","Descripción","Ciudad","Inmueble","Nivel","Ambiente","Responsable","CI Responsable"]
 * - 12 columnas pendientes desglosada: ["Código","Rubro","Tipo Rubro","Descripción","Ciudad","Inmueble","Nivel","Ambiente","Responsable","CI Responsable","Estado Inventario","Usuario Inventario"]
 * Detecta el layout por el largo del primer dataRow devuelto por mapActivoRow.
 */
export const exportInmuebleExcel = ({
  items = [],
  ciudadName = "Todas",
  inmuebleName = "Todos",
  mapActivoRow,
  fileNamePrefix = "Activos_Por_Inventariar",
}) => {
  if (!items || items.length === 0) return;

  const dataRows = items.map(mapActivoRow);
  const colLen = dataRows.length > 0 ? dataRows[0].length : 0;
  const is12Cols = colLen === 12;
  const is10Cols = colLen === 10;
  const is9Cols = colLen === 9;
  let headers;
  if (is12Cols) headers = ["Código", "Rubro", "Tipo Rubro", "Descripción", "Ciudad", "Inmueble", "Nivel", "Ambiente", "Responsable", "CI Responsable", "Estado Inventario", "Usuario Inventario"];
  else if (is10Cols) headers = ["Código", "Rubro", "Tipo Rubro", "Descripción", "Ciudad", "Inmueble", "Nivel", "Ambiente", "Responsable", "CI Responsable"];
  else if (is9Cols) headers = ["Código", "Rubro", "Tipo Rubro", "Descripción", "Ambiente", "Responsable", "CI Responsable", "Estado Inventario", "Usuario Inventario"];
  else headers = ["Código", "Rubro", "Tipo Rubro", "Descripción", "Ambiente", "Responsable", "CI Responsable"];

  // Ordenar ascendente por INMUEBLE cuando hay desglose (10 o 12)
  const isDesglosado = is10Cols || is12Cols;
  if (isDesglosado && dataRows.length > 1) {
    dataRows.sort((a, b) => {
      const inmA = String(a[5] ?? "").trim();
      const inmB = String(b[5] ?? "").trim();
      const cmp = inmA.localeCompare(inmB, "es", { sensitivity: "base", numeric: true });
      if (cmp !== 0) return cmp;
      const ciuCmp = String(a[4] ?? "").localeCompare(String(b[4] ?? ""), "es", { sensitivity: "base", numeric: true });
      if (ciuCmp !== 0) return ciuCmp;
      const nivCmp = String(a[6] ?? "").localeCompare(String(b[6] ?? ""), "es", { sensitivity: "base", numeric: true });
      if (nivCmp !== 0) return nivCmp;
      const ambCmp = String(a[7] ?? "").localeCompare(String(b[7] ?? ""), "es", { sensitivity: "base", numeric: true });
      if (ambCmp !== 0) return ambCmp;
      return String(a[0] ?? "").localeCompare(String(b[0] ?? ""), "es", { numeric: true });
    });
  }

  const sheetData = [
    ["REPORTES DE ACTIVOS - ÓRGANO JUDICIAL"],
    [`CIUDAD: ${ciudadName || "Todas"}`, "", `INMUEBLE: ${inmuebleName || "Todos"}`],
    [`Total activos: ${items.length}`],
    [],
    headers,
    ...dataRows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  if (is12Cols) ws["!cols"] = [{ wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 32 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 12 }, { wch: 16 }, { wch: 20 }];
  else if (is10Cols) ws["!cols"] = [{ wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 32 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 14 }];
  else if (is9Cols) ws["!cols"] = [{ wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 32 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 16 }, { wch: 20 }];
  else ws["!cols"] = [{ wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 32 }, { wch: 24 }, { wch: 22 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Activos");

  const safeInmueble = (inmuebleName || "Inmueble").replace(/[^a-zA-Z0-9]+/g, "_");
  XLSX.writeFile(wb, `${fileNamePrefix}_${safeInmueble}.xlsx`);
};

/**
 * Genera y descarga el Excel de los PANELES visibles en Activos por Inmueble
 * según el filtro aplicado. Replica exactamente lo que ve el usuario:
 * - Filtro, resumen general, por inventariador, detalle por inmueble/nivel/ambiente
 * - Hoja separada con ACTIVOS POR INVENTARIAR (pendientes) si existen
 */
export const exportInmueblePanelesFiltradoExcel = ({
  result,
  ciudad = "",
  inmueble = "",
  nivel = "",
  ambiente = "",
  selectedCiudadName = "",
  selectedInmuebleName = "",
  selectedNivelName = "",
  selectedAmbienteName = "",
  ciudadInmueblesStats = [],
  inmuebleNivelesStats = [],
  nivelAmbientesStats = [],
  pendientes = [],
  getDisplayName = (e) => e,
  mapActivoRow,
}) => {
  if (!result) return;

  const ubicacionStr = [
    selectedCiudadName || (ciudad ? ciudad : null) || "Todas",
    selectedInmuebleName || (inmueble ? inmueble : null) || "Todos",
    selectedNivelName || (nivel ? nivel : null),
    selectedAmbienteName || (ambiente ? ambiente : null),
  ].filter(Boolean).join(" - ");

  const pctAvance = result.totalInmueble > 0 ? ((result.totalInventariado / result.totalInmueble) * 100).toFixed(2) + "%" : "0.00%";

  const sheetData = [
    ["REPORTE DE PANELES POR INMUEBLE - ÓRGANO JUDICIAL"],
    [`Generado: ${new Date().toLocaleString("es-BO")}`],
    [],
    ["FILTRO APLICADO"],
    ["Ciudad", selectedCiudadName || ciudad || "Todas"],
    ["Inmueble", selectedInmuebleName || inmueble || "Todos"],
    ["Nivel", selectedNivelName || nivel || "Todos"],
    ["Ambiente", selectedAmbienteName || ambiente || "Todos"],
    [],
    ["RESUMEN GENERAL"],
    ["Ubicación", ubicacionStr],
    ["Porcentaje de avance", pctAvance],
    ["Total en inmueble", result.totalInmueble],
    ["Total inventariados", result.totalInventariado],
    ["Total en proceso", result.totalEnProceso],
  ];

  if (result.perUser && result.perUser.length > 0) {
    sheetData.push([]);
    sheetData.push(["RESUMEN POR INVENTARIADOR"]);
    sheetData.push(["Inventariador", "Email", "En Proceso", "Inventariados", "Total usuario", "% Avance s/ total inmueble"]);
    (result.perUser || []).forEach((stat) => {
      const pct = result.totalInmueble > 0 ? ((stat.inventariado / result.totalInmueble) * 100).toFixed(2) + "%" : "0.00%";
      sheetData.push([
        getDisplayName(stat.email),
        stat.email,
        stat.enProceso ?? 0,
        stat.inventariado ?? 0,
        stat.total ?? (stat.enProceso + stat.inventariado) ?? 0,
        pct,
      ]);
    });
  }

  // Detalle condicionado al filtro
  const isCiudadOnly = Boolean(ciudad && !inmueble && !nivel && !ambiente);
  const isInmuebleOnly = Boolean(inmueble && !nivel && !ambiente);
  const isNivelOnly = Boolean(nivel && !ambiente);

  if (isCiudadOnly && ciudadInmueblesStats.length > 0) {
    sheetData.push([]);
    sheetData.push([`DETALLE POR INMUEBLE — ${selectedCiudadName || ciudad}`]);
    sheetData.push(["Inmueble", "Código inmueble", "Total activos", "Inventariados", "En Proceso", "% Avance"]);
    ciudadInmueblesStats.forEach((s) => {
      sheetData.push([s.inmueble, s.codigoinmueble, s.totalInmueble, s.totalInventariado, s.totalEnProceso, `${s.porcentaje ?? 0}%`]);
    });
  }

  if (isInmuebleOnly && inmuebleNivelesStats.length > 0) {
    sheetData.push([]);
    sheetData.push([`DETALLE POR NIVEL — ${selectedInmuebleName || inmueble}`]);
    sheetData.push(["Nivel", "Código nivel", "Total activos", "Inventariados", "En Proceso", "% Avance"]);
    inmuebleNivelesStats.forEach((s) => {
      sheetData.push([s.nivel, s.codigonivel, s.totalInmueble, s.totalInventariado, s.totalEnProceso, `${s.porcentaje ?? 0}%`]);
    });
  }

  if (isNivelOnly && nivelAmbientesStats.length > 0) {
    sheetData.push([]);
    sheetData.push([`DETALLE POR AMBIENTE — ${selectedNivelName || nivel}`]);
    sheetData.push(["Ambiente", "Código ambiente", "Total activos", "Inventariados", "En Proceso", "% Avance"]);
    nivelAmbientesStats.forEach((s) => {
      sheetData.push([s.ambiente, s.codigoambiente, s.totalInmueble, s.totalInventariado, s.totalEnProceso, `${s.porcentaje ?? 0}%`]);
    });
  }

  // Totales de pendientes en el resumen
  sheetData.push([]);
  sheetData.push(["ACTIVOS POR INVENTARIAR (Pendientes)"]);
  sheetData.push(["Total pendientes", pendientes.length]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  ws["!cols"] = [{ wch: 36 }, { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 18 }];
  // Negrita para títulos (estilo básico)
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
  XLSX.utils.book_append_sheet(wb, ws, "Paneles");

  // Hoja 2: listado completo de pendientes con columnas de activo
  if (pendientes.length > 0 && mapActivoRow) {
    const headers = ["Código", "Rubro", "Tipo Rubro", "Descripción", "Ambiente", "Responsable", "CI Responsable"];
    const dataRows = pendientes.map(mapActivoRow);
    const pendSheet = [
      ["ACTIVOS POR INVENTARIAR - DETALLE"],
      [`Filtro: ${ubicacionStr}`],
      [`Total: ${pendientes.length}`],
      [],
      headers,
      ...dataRows,
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(pendSheet);
    ws2["!cols"] = [{ wch: 14 }, { wch: 22 }, { wch: 22 }, { wch: 40 }, { wch: 30 }, { wch: 25 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Por Inventariar");
  }

  const safeCiudad = (selectedCiudadName || ciudad || "Filtro").replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 20);
  const safeInmueble = (selectedInmuebleName || inmueble || "").replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 20);
  const suffix = [safeCiudad, safeInmueble].filter(Boolean).join("_");
  XLSX.writeFile(wb, `Reporte_Paneles_${suffix || "SinFiltro"}.xlsx`);
};
