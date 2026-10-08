import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
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

const HEADERS = [
  "N°", "Código Activo", "Código Interno", "Descripción Activo",
  "Tipo Actual", "Tipo Actual Desc", "Rubro Actual",
  "Tipo Destino", "Tipo Destino Desc", "Rubro Destino",
  "Ciudad", "Inmueble", "Nivel", "Ambiente", "Estado Inventario",
];

/**
 * Reporte RECLASIFICAR EL RUBRO en Excel.
 * Hojas: "Resumen" (origen -> destino) y "Detalle" (activos a reclasificar).
 */
export const useReporteReclasificarRubroExcel = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    try {
      toast({ title: "Generando Reclasificar el Rubro (Excel)", description: "Cargando catálogos y vigentes..." });
      const { grupos, items, totalVigentes } = await fetchReclasificarPayload();

      if (items.length === 0) {
        toast({ title: "Sin datos", description: "No hay activos vigentes para reclasificar.", variant: "destructive" });
        return;
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      const resumenSheet = [
        ["RECLASIFICAR EL RUBRO - RESUMEN - ÓRGANO JUDICIAL"],
        [`Vigentes: ${totalVigentes} | A reclasificar: ${items.length} | Descripciones ambiguas: ${grupos.length}`],
        [`Fecha: ${dateStr} | Destino = código con más vigentes del mismo nombre`],
        [],
        ["#", "Tipo (descripción)", "Origen actual (tipo: rubro: vigentes)", "Destino sugerido", "A reclasificar"],
        ...grupos.map((g, idx) => {
          const nReclas = g.detalle.filter((d) => !d.esDestino).reduce((s, d) => s + d.vigentes, 0);
          const origen = g.detalle.filter((d) => !d.esDestino).map((d) => `${d.tipo}: ${d.rubro}: ${d.vigentes}`).join(" + ") || "—";
          return [idx + 1, g.descripcion, origen, `${g.canonico} (${g.rubroDestino})`, nReclas];
        }),
        ["", "TOTAL", "", "", items.length],
      ];

      const detalleSheet = [
        ["RECLASIFICAR EL RUBRO - DETALLE - ÓRGANO JUDICIAL"],
        [`Total a reclasificar: ${items.length} (ultimoregistro=1, código no canónico)`],
        [`Fecha: ${dateStr}`],
        [],
        HEADERS,
        ...items.map((it, i) => ([
          i + 1,
          it.codigoActivo != null ? `OJ-02-${it.codigoActivo}` : "—",
          it.codigoInterno || "—",
          it.descripcionActivo,
          it.tipoActual,
          it.tipoActualDesc,
          it.rubroActual,
          it.tipoDestino,
          it.tipoDestinoDesc,
          it.rubroDestino,
          it.ciudad,
          it.inmueble,
          it.nivel,
          it.ambiente,
          it.estadoInventario,
        ])),
      ];

      const wb = XLSX.utils.book_new();
      const wsResumen = XLSX.utils.aoa_to_sheet(resumenSheet);
      wsResumen["!cols"] = [{ wch: 6 }, { wch: 34 }, { wch: 52 }, { wch: 40 }, { wch: 16 }];
      const wsDetalle = XLSX.utils.aoa_to_sheet(detalleSheet);
      wsDetalle["!cols"] = [
        { wch: 7 }, { wch: 16 }, { wch: 14 }, { wch: 50 },
        { wch: 12 }, { wch: 30 }, { wch: 30 },
        { wch: 12 }, { wch: 30 }, { wch: 30 },
        { wch: 22 }, { wch: 28 }, { wch: 18 }, { wch: 28 }, { wch: 16 },
      ];
      XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");
      XLSX.utils.book_append_sheet(wb, wsDetalle, "Detalle");
      XLSX.writeFile(wb, `Reclasificar_El_Rubro_${dateStr}.xlsx`);

      toast({ title: "Reporte generado", description: `Se exportaron ${items.length} activos a reclasificar.` });
    } catch (err) {
      console.error("Error generando Reclasificar el Rubro (Excel)", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
