import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { LOGO_JPG_DATA_URL } from "@/lib/logoJpgBase64";

const LOGO_W = 48;
const LOGO_H = LOGO_W * (57 / 256);
const addLogo = (doc) => {
  try {
    doc.addImage(LOGO_JPG_DATA_URL, "JPEG", 14, 8, LOGO_W, LOGO_H);
  } catch (_) {
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
}) => {
  if (!items || items.length === 0) return;

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

  const body = items.map(mapActivoRow);

  autoTable(doc, {
    startY,
    head: [["Código", "Rubro", "Tipo Rubro", "Descripción", "Ambiente", "Responsable", "CI Responsable"]],
    body,
    theme: "striped",
    styles: { font: "helvetica", fontSize: 7, cellPadding: 1.2, overflow: "linebreak" },
    headStyles: { fillColor: headerColor, textColor: [255, 255, 255], halign: "center" },
    columnStyles: {
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
 * Genera y descarga un reporte Excel (.xlsx) para los activos de un inmueble.
 */
export const exportInmuebleExcel = ({
  items = [],
  ciudadName = "Todas",
  inmuebleName = "Todos",
  mapActivoRow,
  fileNamePrefix = "Activos_Por_Inventariar",
}) => {
  if (!items || items.length === 0) return;

  const headers = ["Código", "Rubro", "Tipo Rubro", "Descripción", "Ambiente", "Responsable", "CI Responsable"];
  const dataRows = items.map(mapActivoRow);

  const sheetData = [
    ["REPORTES DE ACTIVOS - ÓRGANO JUDICIAL"],
    [`CIUDAD: ${ciudadName || "Todas"}`, "", `INMUEBLE: ${inmuebleName || "Todos"}`],
    [`Total activos: ${items.length}`],
    [],
    headers,
    ...dataRows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Activos");

  const safeInmueble = (inmuebleName || "Inmueble").replace(/[^a-zA-Z0-9]+/g, "_");
  XLSX.writeFile(wb, `${fileNamePrefix}_${safeInmueble}.xlsx`);
};
