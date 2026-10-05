import * as XLSX from "xlsx";

/**
 * Genera y descarga el Excel del panel de control.
 * SRP: lógica de exportación fuera de la UI (InventarioList).
 * @param {object} params
 * @param {{total:number,noRevisados:number,revisados:number,progreso:number}} params.totalStats
 * @param {Array<{email:string,pendiente:number,revisado:number,enProceso:number}>} params.inventariadorStats
 * @param {(email:string)=>string} params.getDisplayName
 */
export function exportPanelesToExcel({ totalStats, inventariadorStats, getDisplayName }) {
  const stats = inventariadorStats || [];
  const totPendientes = stats.reduce((s, st) => s + (st.pendiente || 0), 0);
  const totRevisados = stats.reduce((s, st) => s + (st.revisado || 0), 0);
  const totEnProceso = stats.reduce((s, st) => s + (st.enProceso || 0), 0);
  const rows = [
    ["RESUMEN DE TOTALES"],
    ["TOTAL ACTIVOS INVENTARIADOS", totalStats.total],
    ["NO REVISADOS", totalStats.noRevisados],
    ["REVISADOS", totalStats.revisados],
    ["PROGRESO", `${totalStats.progreso.toFixed(2)}%`],
    [],
    ["RESUMEN POR INVENTARIADOR"],
    ["INVENTARIADOR", "PENDIENTES", "REVISADOS", "EN PROCESO"],
    ...stats.map((stat) => [
      getDisplayName(stat.email),
      stat.pendiente,
      stat.revisado,
      stat.enProceso || 0,
    ]),
    ["TOTAL", totPendientes, totRevisados, totEnProceso],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws, "Panel de Control");
  XLSX.writeFile(wb, "Panel_Control_Inventario.xlsx");
}
