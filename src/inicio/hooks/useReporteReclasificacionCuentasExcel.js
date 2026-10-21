import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
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

/**
 * Reporte RECLASIFICACION DE CUENTAS en Excel.
 * Lee public/Reclasificar.xlsx y genera las hojas Resumen y Detalle.
 * Al detalle se le quitan las columnas Código Interno, Tipo Actual y Tipo Destino.
 */
export const useReporteReclasificacionCuentasExcel = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    try {
      toast({ title: "Generando Reclasificación de Cuentas (Excel)", description: "Leyendo Reclasificar.xlsx..." });
      const { resumen, detalle } = await fetchReclasificacionCuentas();

      if (!detalle.rows.length) {
        toast({ title: "Sin datos", description: "El archivo no contiene activos para reclasificar.", variant: "destructive" });
        return;
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      const resumenSheet = [
        ["RECLASIFICACION DE CUENTAS - RESUMEN - ÓRGANO JUDICIAL"],
        ...resumen.meta.map((line) => [line]),
        [],
        resumen.headers,
        ...resumen.rows,
      ];

      const detalleMeta = detalle.meta.filter((line) => !/^total\b/i.test(String(line).trim()));
      const detalleSheet = [
        ["RECLASIFICACION DE CUENTAS - DETALLE - ÓRGANO JUDICIAL"],
        [`Total a reclasificar: ${detalle.rows.length}`],
        ...detalleMeta.map((line) => [line]),
        [],
        detalle.headers,
        ...detalle.rows,
      ];

      const wb = XLSX.utils.book_new();
      const wsResumen = XLSX.utils.aoa_to_sheet(resumenSheet);
      wsResumen["!cols"] = [
        { wch: 6 }, { wch: 34 }, { wch: 52 }, { wch: 40 }, { wch: 16 },
        { wch: 14 }, { wch: 14 }, { wch: 13 }, { wch: 14 }, { wch: 14 }, { wch: 10 },
        { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 17 }, { wch: 13 }, { wch: 13 },
      ];
      wsResumen["!pageSetup"] = { orientation: "landscape", paperSize: 5, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

      const wsDetalle = XLSX.utils.aoa_to_sheet(detalleSheet);
      wsDetalle["!cols"] = [
        { wch: 7 }, { wch: 16 }, { wch: 50 }, { wch: 30 }, { wch: 30 }, { wch: 30 },
        { wch: 30 }, { wch: 22 }, { wch: 35 }, { wch: 18 }, { wch: 35 },
        { wch: 14 }, { wch: 14 }, { wch: 13 }, { wch: 14 }, { wch: 14 }, { wch: 10 },
        { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 17 }, { wch: 13 }, { wch: 13 },
      ];
      wsDetalle["!pageSetup"] = { orientation: "landscape", paperSize: 5, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

      const resumenDepStart = resumen.headers.length - DEPRECIACION_HEADERS.length;
      const resumenDataStart = resumen.meta.length + 3;
      for (let r = 0; r < resumen.rows.length; r++) {
        for (let c = resumenDepStart; c < resumen.headers.length; c++) {
          const cell = wsResumen[XLSX.utils.encode_cell({ r: resumenDataStart + r, c })];
          if (cell && typeof cell.v === "number") {
            cell.z = c - resumenDepStart === 5 ? "0.00000000" : "#,##0.00";
          }
        }
      }

      const depStart = detalle.headers.length - DEPRECIACION_HEADERS.length;
      const detalleDataStart = detalleMeta.length + 4;
      for (let r = 0; r < detalle.rows.length; r++) {
        for (let c = depStart; c < detalle.headers.length; c++) {
          const cell = wsDetalle[XLSX.utils.encode_cell({ r: detalleDataStart + r, c })];
          if (cell && typeof cell.v === "number") {
            cell.z = c - depStart === 5 ? "0.00000000" : "#,##0.0000";
          }
        }
      }

      XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");
      XLSX.utils.book_append_sheet(wb, wsDetalle, "Detalle");
      XLSX.writeFile(wb, `Reclasificacion_De_Cuentas_${dateStr}.xlsx`);

      toast({ title: "Reporte generado", description: `Se exportaron ${detalle.rows.length} activos a reclasificar.` });
    } catch (err) {
      console.error("Error generando Reclasificación de Cuentas (Excel)", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
