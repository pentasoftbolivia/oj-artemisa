import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { getCachedCatalog } from "@/lib/catalogCache";
import { toCamelCaseArray } from "@/lib/mapFields";
import { useToast } from "@/hooks/use-toast";
import { ACTIVO_COLUMNS } from "@/lib/activoColumns";
import { buildParamTasaMap, resolveTasaFromParams } from "../constants/depreciacionConstants";

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

const parseNum = (v) => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const DEP_HEADERS = [
  "Costo Inicial al 31/12/2025",
  "Depreciacion Acumulada al 31/12/2025",
  "Costo Actualizado",
  "Depreciacion Actualizada",
  "Depreciacion Acumulado Total",
  "%Dep. Mes",
  "Depreciacion del Periodo",
  "Costo Total Actualizado",
  "Depreciacion Total",
];

const HEADERS = ["N°", "Rubro", "Total Activos", ...DEP_HEADERS];

/**
 * Reporte FALTANTES POR RUBRO en Excel.
 * Misma lógica que FALTANTES EN ESTADO ACTIVO:
 * estadoinventario IS NULL OR estadoinventario = ''
 * AND artemisaaltabaja=1 (sin filtro ultimoregistro).
 */
export const useReporteFaltantesPorRubroExcel = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    try {
      toast({ title: "Generando Faltantes por Rubro (Excel)", description: "Cargando catálogos..." });

      const [rubros, tipoRubros, paramDep] = await Promise.all([
        getCachedCatalog("act_rubro"),
        getCachedCatalog("act_tiporubro"),
        supabase.from("act_param_depreciacion").select("rubro,tasa_anual").then(({ data, error }) => {
          if (error) throw error;
          return data || [];
        }),
      ]);
      const paramTasaMap = buildParamTasaMap(paramDep);

      const rubroDescMap = {};
      (rubros || []).forEach((r) => {
        rubroDescMap[r.codigorubroact] = r.descripcionrubroact;
        rubroDescMap[String(r.codigorubroact)] = r.descripcionrubroact;
      });
      const rubroFromTipo = {};
      (tipoRubros || []).forEach((t) => {
        rubroFromTipo[t.tiporubroact] = rubroDescMap[t.codigorubroact];
        rubroFromTipo[String(t.tiporubroact)] = rubroDescMap[t.codigorubroact];
      });

      toast({ title: "Cargando activos", description: "Obteniendo faltantes en estado activo..." });

      let allActivos = [];
      let from = 0;
      const FETCH_CHUNK = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("act_activos")
          .select(`${ACTIVO_COLUMNS},artemisaaltabaja,saldoinicial_exp,depacum_exp,pordepanu,actdepacum_exp,depacumtotal_exp,costactuali_exp`)
          .eq("artemisaaltabaja", 1)
          .order("codigoactivo", { ascending: true })
          .range(from, from + FETCH_CHUNK - 1);
        if (error) throw error;
        const batch = toCamelCaseArray(data || []);
        if (batch.length === 0) break;
        allActivos = allActivos.concat(batch);
        if (batch.length < FETCH_CHUNK) break;
        from += FETCH_CHUNK;
        if (allActivos.length > 100000) break;
        await new Promise((r) => setTimeout(r, 0));
      }

      allActivos = allActivos.filter((a) => {
        const estInv = String(a.estadoinventario ?? a.estadoInventario ?? "").trim();
        if (estInv !== "") return false;
        return Number(a.artemisaaltabaja ?? a.artemisaAltaBaja) === 1;
      });

      if (allActivos.length === 0) {
        toast({ title: "Sin datos", description: "No hay activos faltantes en estado activo.", variant: "destructive" });
        return;
      }

      toast({ title: "Generando Excel", description: `Cargando catálogos...` });

      const dateStr = new Date().toISOString().slice(0, 10);
      const grupos = new Map();
      allActivos.forEach((a) => {
        const tipo = a.tipoRubroAct ?? a.tiporubroact;
        const rubroDesc = String(rubroFromTipo[tipo] ?? rubroFromTipo[String(tipo)] ?? "SIN RUBRO").trim() || "SIN RUBRO";

        const costoInicial = parseNum(a.saldoInicialExp ?? a.saldoinicial_exp);
        const depAcum = parseNum(a.depAcumExp ?? a.depacum_exp);
        const costoActualizado = parseNum(a.porDepAnu ?? a.pordepanu);
        const depActualizada = parseNum(a.actDepAcumExp ?? a.actdepacum_exp);
        const depAcumTotal = parseNum(a.depAcumTotalExp ?? a.depacumtotal_exp);
        const costoTotal = parseNum(a.costActualiExp ?? a.costactuali_exp);
        const tasaAnual = resolveTasaFromParams(rubroDesc, paramTasaMap);
        const depMes = tasaAnual != null ? tasaAnual / 12 : null;
        const depPeriodo = depMes !== null && costoTotal !== null ? (depMes * 10) * costoTotal : null;
        const depTotal = depAcumTotal !== null && depPeriodo !== null ? depAcumTotal + depPeriodo : null;

        if (!grupos.has(rubroDesc)) {
          grupos.set(rubroDesc, {
            count: 0,
            costoInicial: 0,
            depAcum: 0,
            costoActualizado: 0,
            depActualizada: 0,
            depAcumTotal: 0,
            depMes: null,
            depPeriodo: 0,
            costoTotal: 0,
            depTotal: 0,
          });
        }
        const g = grupos.get(rubroDesc);
        g.count += 1;
        g.costoInicial += costoInicial ?? 0;
        g.depAcum += depAcum ?? 0;
        g.costoActualizado += costoActualizado ?? 0;
        g.depActualizada += depActualizada ?? 0;
        g.depAcumTotal += depAcumTotal ?? 0;
        if (g.depMes === null && depMes !== null) g.depMes = depMes;
        g.depPeriodo += depPeriodo ?? 0;
        g.costoTotal += costoTotal ?? 0;
        g.depTotal += depTotal ?? 0;
      });
      const rubrosOrdenados = [...grupos.keys()].sort((x, y) => x.localeCompare(y, "es"));
      const totales = {
        count: 0,
        costoInicial: 0,
        depAcum: 0,
        costoActualizado: 0,
        depActualizada: 0,
        depAcumTotal: 0,
        depPeriodo: 0,
        costoTotal: 0,
        depTotal: 0,
      };
      const rows = rubrosOrdenados.map((rubro, idx) => {
        const g = grupos.get(rubro);
        totales.count += g.count;
        totales.costoInicial += g.costoInicial;
        totales.depAcum += g.depAcum;
        totales.costoActualizado += g.costoActualizado;
        totales.depActualizada += g.depActualizada;
        totales.depAcumTotal += g.depAcumTotal;
        totales.depPeriodo += g.depPeriodo;
        totales.costoTotal += g.costoTotal;
        totales.depTotal += g.depTotal;
        return [
          idx + 1,
          rubro,
          g.count,
          g.costoInicial || "",
          g.depAcum || "",
          g.costoActualizado || "",
          g.depActualizada || "",
          g.depAcumTotal || "",
          g.depMes ?? "",
          g.depPeriodo || "",
          g.costoTotal || "",
          g.depTotal || "",
        ];
      });

      const sheetData = [
        ["FALTANTES POR RUBRO - ÓRGANO JUDICIAL"],
        [`Total activos: ${allActivos.length} en ${rubrosOrdenados.length} rubros`],
        [`Fecha: ${dateStr}`],
        [],
        HEADERS,
        ...rows,
        ["", "TOTAL GENERAL", totales.count, totales.costoInicial, totales.depAcum, totales.costoActualizado, totales.depActualizada, totales.depAcumTotal, "", totales.depPeriodo, totales.costoTotal, totales.depTotal],
      ];

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws["!cols"] = [
        { wch: 6 }, { wch: 30 }, { wch: 14 },
        { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 18 },
        { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 16 },
      ];
      ws["!pageSetup"] = { orientation: "landscape", paperSize: 1, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
      ws["!margins"] = { left: 0.5, right: 0.5, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Por Rubro");
      XLSX.writeFile(wb, `Faltantes_Por_Rubro_${dateStr}.xlsx`);

      toast({ title: "Reporte generado", description: `Se exportaron ${allActivos.length} activos en ${rubrosOrdenados.length} rubros.` });
    } catch (err) {
      console.error("Error generando Faltantes por Rubro (Excel)", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
