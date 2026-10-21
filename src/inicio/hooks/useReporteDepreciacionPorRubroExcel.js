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

const clean = (v) => String(v ?? "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();

const parseNumDep = (v) => {
  if (v === null || v === undefined || String(v).trim() === "") return 0;
  const n = Number(String(v).replace(",", "."));
  return isNaN(n) ? 0 : n;
};

const HEADERS = [
  "N°",
  "Rubro",
  "Activos",
  "Costo Inicial al 31/12/2025",
  "Depreciacion Acumulada al 31/12/2025",
  "Costo Actualizado",
  "Depreciacion Actualizada",
  "Depreciacion Acumulado Total",
  "%Dep. Mes",
  "Depreciacion del Periodo",
  "Costo Total Actualizado al 09/10/2026",
  "Revaluo",
  "Costo Total Actualizado Revaluado",
  "Depreciacion Total",
  "Valor Neto",
];

const RECALC_HEADERS = [
  "N°",
  "Rubro",
  "Activos",
  "Costo Total Actualizado al 09/10/2026",
  "Revaluo",
  "Depreciacion Total",
  "Valor Neto",
];

/**
 * Reporte DEPRECIACION POR RUBRO en Excel.
 * Criterio: codigoactivo <= 43753 AND estadoinventario IS NOT NULL AND estadoinventario <> ''
 * AND artemisaaltabaja IN (0,1) AND ultimoregistro = 1 (mismos activos que el reporte Depreciación).
 * Agrupa por RUBRO y suma las mismas columnas monetarias, incluido el Valor Neto.
 * Usa exactamente el mismo cálculo que el reporte Depreciación:
 * %Dep. Mes = tasa anual/12 redondeado a 8 decimales,
 * Dep. Periodo = (%Dep. Mes * 10) * Costo Total Actualizado,
 * Dep. Total = Dep. Acum. Total + Dep. Periodo y
 * Valor Neto = Costo Total Actualizado Revaluado - Dep. Total.
 * Con options.recalcular, si el Valor Neto es negativo se fuerza Dep. Periodo = 1,
 * Dep. Total = Dep. Acum. Total + 1 y se recalcula el Valor Neto.
 */
export const useReporteDepreciacionPorRubroExcel = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async (options = {}) => {
    const recalcular = !!options?.recalcular;
    setIsGenerating(true);
    try {
      toast({ title: recalcular ? "Generando Depreciación por Rubro Recalculada (Excel)" : "Generando Depreciación por Rubro (Excel)", description: "Cargando catálogos..." });

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

      toast({ title: "Cargando activos", description: "Obteniendo activos con codigoactivo <= 43753, estadoinventario con dato, artemisaaltabaja in (0,1) y ultimoregistro=1..." });

      let allActivos = [];
      let from = 0;
      const FETCH_CHUNK = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("act_activos")
          .select(`${ACTIVO_COLUMNS},artemisaaltabaja,esactivo,saldoinicial_exp,depacum_exp,pordepanu,actdepacum_exp,depacumtotal_exp,costactuali_exp,valorrevaluo`)
          .lte("codigoactivo", 43753)
          .not("estadoinventario", "is", null)
          .neq("estadoinventario", "")
          .in("artemisaaltabaja", [0, 1])
          .eq("ultimoregistro", 1)
          .eq("esactivo", true)
          .order("codigoactivointerno", { ascending: true })
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

      // Regla: codigoactivo <= 43753, estadoinventario con dato, artemisaaltabaja in (0,1), ultimoregistro = 1
      allActivos = allActivos.filter((a) => {
        const codigoActivo = Number(a.codigoActivo ?? a.codigoactivo ?? 0);
        const v = a.artemisaaltabaja ?? a.artemisaAltaBaja;
        const estadoInv = a.estadoinventario ?? a.estadoInventario;
        const ultimoVal = String(a.ultimoregistro ?? "").trim();
        const esActivo = a.esactivo ?? a.esActivo;
        return (
          codigoActivo <= 43753 &&
          estadoInv !== null &&
          estadoInv !== undefined &&
          String(estadoInv) !== "" &&
          (Number(v) === 0 || Number(v) === 1) &&
          ultimoVal === "1" &&
          (esActivo === true || String(esActivo).toLowerCase() === "true" || Number(esActivo) === 1)
        );
      });

      if (allActivos.length === 0) {
        toast({ title: "Sin datos", description: "No hay activos con codigoactivo <= 43753, estadoinventario con dato, artemisaaltabaja in (0,1) y ultimoregistro=1.", variant: "destructive" });
        return;
      }

      const grupos = new Map();
      allActivos.forEach((a) => {
        const tipoRubroAct = a.tipoRubroAct ?? a.tiporubroact;
        const rubroDesc = String(rubroFromTipo[tipoRubroAct] ?? rubroFromTipo[String(tipoRubroAct)] ?? "SIN RUBRO").trim() || "SIN RUBRO";

        const saldoInicial = parseNumDep(a.saldoInicialExp ?? a.saldoinicial_exp);
        const depAcum = parseNumDep(a.depAcumExp ?? a.depacum_exp);
        const costoAct = parseNumDep(a.porDepAnu ?? a.pordepanu);
        const depActualizada = parseNumDep(a.actDepAcumExp ?? a.actdepacum_exp);
        const depAcumTotal = parseNumDep(a.depAcumTotalExp ?? a.depacumtotal_exp);
        const costoTotal0910 = parseNumDep(a.costActualiExp ?? a.costactuali_exp);
        const revaluo = parseNumDep(a.valorRevaluo ?? a.valorrevaluo);
        const costoTotalRevaluado = costoTotal0910 + revaluo;
        const tasaAnual = resolveTasaFromParams(rubroDesc, paramTasaMap);
        const depMesRaw = tasaAnual !== null && tasaAnual !== undefined ? tasaAnual / 12 : null;
        const depMes = depMesRaw !== null && depMesRaw !== undefined ? Number(depMesRaw.toFixed(8)) : null;
        const depPeriodo = depMes !== null && costoTotal0910 !== null ? (depMes * 10) * costoTotal0910 : null;
        const depTotal = depAcumTotal !== null && depPeriodo !== null ? depAcumTotal + depPeriodo : null;
        const valorNeto = depTotal !== null ? costoTotalRevaluado - depTotal : null;

        let depPeriodoMostrar = depPeriodo;
        let depTotalMostrar = depTotal;
        let valorNetoMostrar = valorNeto;
        if (recalcular && valorNeto !== null && valorNeto < 0) {
          depPeriodoMostrar = 1;
          depTotalMostrar = depAcumTotal !== null ? depAcumTotal + 1 : null;
          valorNetoMostrar = depTotalMostrar !== null ? costoTotalRevaluado - depTotalMostrar : null;
        }

        if (!grupos.has(rubroDesc)) {
          grupos.set(rubroDesc, {
            activos: 0, saldoInicial: 0, depAcum: 0, costoAct: 0, depActualizada: 0,
            depAcumTotal: 0, depMes: null, depPeriodo: 0, costoTotal0910: 0, revaluo: 0,
            costoTotalRevaluado: 0, depTotal: 0, valorNeto: 0,
          });
        }
        const g = grupos.get(rubroDesc);
        g.activos += 1;
        g.saldoInicial += saldoInicial;
        g.depAcum += depAcum;
        g.costoAct += costoAct;
        g.depActualizada += depActualizada;
        g.depAcumTotal += depAcumTotal;
        if (g.depMes === null && depMes !== null) g.depMes = depMes;
        g.depPeriodo += depPeriodoMostrar ?? 0;
        g.costoTotal0910 += costoTotal0910;
        g.revaluo += revaluo;
        g.costoTotalRevaluado += costoTotalRevaluado;
        g.depTotal += depTotalMostrar ?? 0;
        g.valorNeto += valorNetoMostrar ?? 0;
      });

      const rubrosOrdenados = [...grupos.keys()].sort((x, y) => x.localeCompare(y, "es"));
      const rows = rubrosOrdenados.map((rubro, idx) => {
        const g = grupos.get(rubro);
        if (recalcular) {
          return [
            idx + 1,
            clean(rubro),
            g.activos,
            g.costoTotal0910,
            g.revaluo,
            g.depTotal,
            g.valorNeto,
          ];
        }
        return [
          idx + 1,
          clean(rubro),
          g.activos,
          g.saldoInicial,
          g.depAcum,
          g.costoAct,
          g.depActualizada,
          g.depAcumTotal,
          g.depMes ?? "",
          g.depPeriodo,
          g.costoTotal0910,
          g.revaluo,
          g.costoTotalRevaluado,
          g.depTotal,
          g.valorNeto,
        ];
      });

      const tot = rubrosOrdenados.reduce((acc, rubro) => {
        const g = grupos.get(rubro);
        acc.activos += g.activos;
        acc.saldoInicial += g.saldoInicial;
        acc.depAcum += g.depAcum;
        acc.costoAct += g.costoAct;
        acc.depActualizada += g.depActualizada;
        acc.depAcumTotal += g.depAcumTotal;
        acc.depPeriodo += g.depPeriodo;
        acc.costoTotal0910 += g.costoTotal0910;
        acc.revaluo += g.revaluo;
        acc.costoTotalRevaluado += g.costoTotalRevaluado;
        acc.depTotal += g.depTotal;
        acc.valorNeto += g.valorNeto;
        return acc;
      }, {
        activos: 0, saldoInicial: 0, depAcum: 0, costoAct: 0, depActualizada: 0,
        depAcumTotal: 0, depPeriodo: 0, costoTotal0910: 0, revaluo: 0,
        costoTotalRevaluado: 0, depTotal: 0, valorNeto: 0,
      });

      toast({ title: "Generando Excel", description: `Construyendo reporte con ${rubrosOrdenados.length} rubros...` });

      const dateStr = new Date().toISOString().slice(0, 10);
      const sheetData = [
        [recalcular ? "RECALCULAR DEPRECIACION POR RUBRO - ÓRGANO JUDICIAL" : "DEPRECIACION POR RUBRO - ÓRGANO JUDICIAL"],
        [`Total activos: ${allActivos.length}`],
        [`Fecha: ${dateStr}`],
        [],
        recalcular ? RECALC_HEADERS : HEADERS,
        ...rows,
        recalcular
          ? [
              "",
              "TOTAL GENERAL",
              tot.activos,
              tot.costoTotal0910,
              tot.revaluo,
              tot.depTotal,
              tot.valorNeto,
            ]
          : [
              "",
              "TOTAL GENERAL",
              tot.activos,
              tot.saldoInicial,
              tot.depAcum,
              tot.costoAct,
              tot.depActualizada,
              tot.depAcumTotal,
              "",
              tot.depPeriodo,
              tot.costoTotal0910,
              tot.revaluo,
              tot.costoTotalRevaluado,
              tot.depTotal,
              tot.valorNeto,
            ],
      ];

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws["!cols"] = recalcular
        ? [{ wch: 6 }, { wch: 40 }, { wch: 8 }, { wch: 32 }, { wch: 20 }, { wch: 20 }, { wch: 18 }]
        : [
            { wch: 6 }, { wch: 32 }, { wch: 10 }, { wch: 24 }, { wch: 24 }, { wch: 18 },
            { wch: 20 }, { wch: 22 }, { wch: 12 }, { wch: 22 }, { wch: 28 }, { wch: 18 },
            { wch: 28 }, { wch: 22 }, { wch: 18 },
          ];
      ws["!pageSetup"] = { orientation: "landscape", paperSize: 1, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
      ws["!margins"] = { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
      ws["!printOptions"] = { horizontalCentered: true };
      ws["!sheetProps"] = { pageSetUpPr: { fitToPage: true } };

      const moneyFmt = "#,##0.0000";
      const mesFmt = "0.00000000";
      const moneyCols = recalcular ? [3, 4, 5, 6] : [3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14];
      for (let r = 0; r < rows.length; r++) {
        const rowNumber = 6 + r;
        for (const c of moneyCols) {
          const cell = ws[XLSX.utils.encode_cell({ r: rowNumber - 1, c })];
          if (cell && typeof cell.v === "number") cell.z = moneyFmt;
        }
        if (!recalcular) {
          const mesCell = ws[XLSX.utils.encode_cell({ r: rowNumber - 1, c: 8 })];
          if (mesCell && typeof mesCell.v === "number") mesCell.z = mesFmt;
        }
      }
      for (const c of moneyCols) {
        const totalCell = ws[XLSX.utils.encode_cell({ r: 5 + rows.length, c })];
        if (totalCell && typeof totalCell.v === "number") totalCell.z = moneyFmt;
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Depreciacion Rubro");
      XLSX.writeFile(wb, recalcular ? `Recalcular_Depreciacion_Por_Rubro_${dateStr}.xlsx` : `Depreciacion_Por_Rubro_${dateStr}.xlsx`);

      toast({ title: "Reporte generado", description: `Se exportaron ${allActivos.length} activos en ${rubrosOrdenados.length} rubros.` });
    } catch (err) {
      console.error("Error generando Depreciación por Rubro (Excel)", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
