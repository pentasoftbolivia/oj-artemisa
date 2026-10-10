import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { getCachedCatalog } from "@/lib/catalogCache";
import { toCamelCaseArray } from "@/lib/mapFields";
import { useToast } from "@/hooks/use-toast";
import { ACTIVO_COLUMNS } from "@/lib/activoColumns";

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

const normTxt = (s) =>
  String(s || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Excepción: no tomar en cuenta BIBLIOTECA, TERRENOS, EDIFICACIONES
const RUBROS_EXCLUIDOS = ["BIBLIOTEC", "TERRENO", "EDIFICAC"];

const parseNum = (v) => {
  if (v == null || String(v).trim() === "") return 0;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Reporte Grupo Contable en Excel — PRODUCTO 3.
 * Hoja 1: N°, GRUPO CONTABLE, CANTIDAD ACTIVOS (todos con ultim=1; excluye 3 rubros)
 * Hoja 2: GRUPO CONTABLE DE RUBROS EXCLUIDOS — solo BIBLIOTECA, TERRENOS, EDIFICACIONES
 * Hoja 3: revaluados (todos ultim=1; cantidad y neto de todos, revaluado suma valorrevaluo)
 */
export const useReporteGrupoContableExcel = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    try {
      toast({ title: "Generando Grupo Contable (Excel)", description: "Cargando catálogos..." });

      const [rubros, tipoRubros] = await Promise.all([
        getCachedCatalog("act_rubro"),
        getCachedCatalog("act_tiporubro"),
      ]);

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

      toast({ title: "Cargando activos", description: "Obteniendo todos los activos vigentes (ultimoregistro=1)..." });

      let allActivos = [];
      let from = 0;
      const FETCH_CHUNK = 1000;
      while (true) {
        // Sin filtro estadoinventario en servidor (case/espacios los maneja el cliente)
        const { data, error } = await supabase
          .from("act_activos")
          .select(ACTIVO_COLUMNS)
          .eq("ultimoregistro", 1)
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
      const totalVigentes = allActivos.length;
      // Hoja 2 (rubros excluidos) usa la misma base de vigentes
      const baseRubrosExcluidos = [...allActivos];

      // Hoja 1: todos los ultimoregistro=1, solo se excluyen los 3 rubros
      allActivos = allActivos.filter((a) => {
        const rubroDesc = rubroFromTipo[a.tipoRubroAct] ?? rubroFromTipo[String(a.tipoRubroAct)] ?? "";
        const n = normTxt(rubroDesc);
        return !RUBROS_EXCLUIDOS.some((k) => n.includes(k));
      });
      console.debug("[GrupoContableExcel] vigentes (ultim=1):", totalVigentes, "| tras excluir 3 rubros:", allActivos.length);

      if (allActivos.length === 0) {
        toast({ title: "Sin datos", description: "No hay activos vigentes para el reporte.", variant: "destructive" });
        return;
      }

      const grupos = new Map();
      allActivos.forEach((a) => {
        const rubroDesc = String(rubroFromTipo[a.tipoRubroAct] ?? rubroFromTipo[String(a.tipoRubroAct)] ?? "SIN RUBRO").trim() || "SIN RUBRO";
        grupos.set(rubroDesc, (grupos.get(rubroDesc) ?? 0) + 1);
      });
      const ordenados = [...grupos.keys()].sort((x, y) => x.localeCompare(y, "es"));

      const totalCantidad = ordenados.reduce((s, k) => s + grupos.get(k), 0);

      toast({ title: "Generando Excel", description: `Construyendo reporte con ${ordenados.length} grupos...` });

      const dateStr = new Date().toISOString().slice(0, 10);
      const sheetData = [
        ["REPORTE GRUPO CONTABLE - ÓRGANO JUDICIAL"],
        [`Total activos: ${totalCantidad} en ${ordenados.length} grupos`],
        [`Fecha: ${dateStr}`],
        [],
        ["N°", "GRUPO CONTABLE", "CANTIDAD ACTIVOS"],
        ...ordenados.map((rubro, idx) => [idx + 1, rubro, grupos.get(rubro)]),
        ["", "TOTAL GENERAL", totalCantidad],
      ];

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws["!cols"] = [{ wch: 6 }, { wch: 55 }, { wch: 18 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Grupo Contable");

      // ---- Hoja 2: GRUPO CONTABLE DE RUBROS EXCLUIDOS ----
      // Solo ultimoregistro=1 (sin filtro de estado) y SOLO
      // BIBLIOTECA, TERRENOS y EDIFICACIONES, agrupado por rubro.
      const excActivos = baseRubrosExcluidos.filter((a) => {
        const rubroDesc = rubroFromTipo[a.tipoRubroAct] ?? rubroFromTipo[String(a.tipoRubroAct)] ?? "";
        return RUBROS_EXCLUIDOS.some((k) => normTxt(rubroDesc).includes(k));
      });
      const excGrupos = new Map();
      excActivos.forEach((a) => {
        const rubroDesc = String(rubroFromTipo[a.tipoRubroAct] ?? rubroFromTipo[String(a.tipoRubroAct)] ?? "SIN RUBRO").trim() || "SIN RUBRO";
        excGrupos.set(rubroDesc, (excGrupos.get(rubroDesc) ?? 0) + 1);
      });
      const excOrdenados = [...excGrupos.keys()].sort((x, y) => x.localeCompare(y, "es"));
      const excTotal = excOrdenados.reduce((s, k) => s + excGrupos.get(k), 0);
      const excSheet = [
        ["GRUPO CONTABLE DE RUBROS EXCLUIDOS - ÓRGANO JUDICIAL"],
        [`Total activos: ${excTotal} en ${excOrdenados.length} grupos`],
        [`Fecha: ${dateStr}`],
        [],
        ["N°", "GRUPO CONTABLE", "CANTIDAD ACTIVOS"],
        ...excOrdenados.map((rubro, idx) => [idx + 1, rubro, excGrupos.get(rubro)]),
        ["", "TOTAL GENERAL", excTotal],
      ];
      const wsExc = XLSX.utils.aoa_to_sheet(excSheet);
      wsExc["!cols"] = [{ wch: 6 }, { wch: 55 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, wsExc, "Rubros Excluidos");

      // ---- Hoja 3: activos revaluados por grupo contable ----
      // Base: TODOS los ultimoregistro=1 (sin filtro de estado ni pararevaluo).
      // CANTIDAD y VALOR NETO de todos; VALOR REVALUADO = suma de valorrevaluo.
      toast({ title: "Cargando revalúo", description: "Obteniendo todos los activos vigentes..." });
      const SELECT_REV = `${ACTIVO_COLUMNS},valorneto,valorrevaluo`;
      let revActivos = [];
      {
        let rFrom = 0;
        while (true) {
          const { data, error } = await supabase
            .from("act_activos")
            .select(SELECT_REV)
            .eq("ultimoregistro", 1)
            .order("codigoactivointerno", { ascending: true })
            .range(rFrom, rFrom + FETCH_CHUNK - 1);
          if (error) throw error;
          const batch = toCamelCaseArray(data || []);
          if (batch.length === 0) break;
          revActivos = revActivos.concat(batch);
          if (batch.length < FETCH_CHUNK) break;
          rFrom += FETCH_CHUNK;
          if (revActivos.length > 100000) break;
          await new Promise((r) => setTimeout(r, 0));
        }
      }
      const totalRevBase = revActivos.length;
      console.debug("[GrupoContableExcel] hoja3 base todos ultim=1:", totalRevBase);
      const revGrupos = new Map();
      revActivos.forEach((a) => {
        const rubroDesc = String(rubroFromTipo[a.tipoRubroAct] ?? rubroFromTipo[String(a.tipoRubroAct)] ?? "SIN RUBRO").trim() || "SIN RUBRO";
        const cur = revGrupos.get(rubroDesc) || { cantidad: 0, valorNeto: 0, valorRevaluado: 0 };
        cur.cantidad += 1;
        cur.valorNeto += parseNum(a.valorNeto ?? a.valorneto);
        cur.valorRevaluado += parseNum(a.valorRevaluo ?? a.valorrevaluo);
        revGrupos.set(rubroDesc, cur);
      });
      const revOrdenados = [...revGrupos.keys()].sort((x, y) => x.localeCompare(y, "es"));
      const revTotalCant = revOrdenados.reduce((s, k) => s + revGrupos.get(k).cantidad, 0);
      const revTotalNeto = round2(revOrdenados.reduce((s, k) => s + revGrupos.get(k).valorNeto, 0));
      const revTotalRev = round2(revOrdenados.reduce((s, k) => s + revGrupos.get(k).valorRevaluado, 0));
      const revSheet = [
        ["ACTIVOS REVALUADOS POR GRUPO CONTABLE - ÓRGANO JUDICIAL"],
        [`Total activos: ${revTotalCant} en ${revOrdenados.length} grupos`],
        [`Fecha: ${dateStr}`],
        [],
        ["N°", "GRUPO CONTABLE", "CANTIDAD DE ACTIVOS", "VALOR NETO REGISTRADO (Bs.)", "VALOR REVALUADO (Bs.)"],
        ...revOrdenados.map((rubro, idx) => {
          const g = revGrupos.get(rubro);
          return [idx + 1, rubro, g.cantidad, round2(g.valorNeto), round2(g.valorRevaluado)];
        }),
        ["", "TOTAL GENERAL", revTotalCant, revTotalNeto, revTotalRev],
      ];
      const wsRev = XLSX.utils.aoa_to_sheet(revSheet);
      wsRev["!cols"] = [{ wch: 6 }, { wch: 50 }, { wch: 20 }, { wch: 26 }, { wch: 24 }];
      const revFirstData = 6;
      const revLast = revFirstData + revOrdenados.length;
      for (let r = revFirstData; r <= revLast; r++) {
        ["D", "E"].forEach((col) => {
          const cell = wsRev[`${col}${r}`];
          if (cell && typeof cell.v === "number") cell.z = "#,##0.00";
        });
      }
      XLSX.utils.book_append_sheet(wb, wsRev, "Para Revaluo");
      XLSX.writeFile(wb, `Reporte_Grupo_Contable_${dateStr}.xlsx`);

      toast({ title: "Reporte generado", description: `Hoja 1: ${totalCantidad} en ${ordenados.length} grupos. Hoja 2 excluidas: ${excTotal} en ${excOrdenados.length} grupos. Hoja 3 revaluados: ${revTotalCant} en ${revOrdenados.length} grupos.` });
    } catch (err) {
      console.error("Error generando Reporte Grupo Contable (Excel)", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
