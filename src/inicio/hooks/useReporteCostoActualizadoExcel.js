import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { toCamelCaseArray } from "@/lib/mapFields";
import { getCachedCatalog } from "@/lib/catalogCache";
import { useToast } from "@/hooks/use-toast";

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

// Lee los activos desde Supabase con el criterio:
// codigoactivo <= 43753, estadoinventario con dato, artemisaaltabaja in (0,1), ultimoregistro = 1.
const FETCH_CHUNK = 1000;
const loadActivosFromDB = async (onProgress) => {
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("act_activos")
      .select("codigoactivo,tiporubroact,valorinicial,saldoinicial_exp,depacum_exp,estadoinventario,artemisaaltabaja,ultimoregistro")
      .lte("codigoactivo", 43753)
      .not("estadoinventario", "is", null)
      .neq("estadoinventario", "")
      .in("artemisaaltabaja", [0, 1])
      .eq("ultimoregistro", 1)
      .order("codigoactivointerno", { ascending: true })
      .range(from, from + FETCH_CHUNK - 1);
    if (error) throw error;
    const batch = toCamelCaseArray(data || []);
    if (batch.length === 0) break;
    all = all.concat(batch);
    if (batch.length < FETCH_CHUNK) break;
    from += FETCH_CHUNK;
    if (all.length > 100000) break;
    onProgress?.(`Cargando activos (${all.length})...`);
    await new Promise((r) => setTimeout(r, 0));
  }
  return all;
};

const toNumber = (v) => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
};

/**
 * Reporte Costo Actualizado y Depreciación en Excel.
 * Fuente: Supabase (act_activos).
 * Agrupa por RUBRO y suma valorinicial (->Saldo Inicial), saldoinicial_exp (->Costo Actualizado) y depacum_exp.
 * Alcance: codigoactivo <= 43753, estadoinventario con dato, artemisaaltabaja in (0,1) y ultimoregistro = 1.
 */
export const useReporteCostoActualizadoExcel = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    try {
      toast({ title: "Generando Costo Actualizado y Depreciación (Excel)", description: "Cargando catálogos..." });

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

      toast({ title: "Cargando datos", description: "Obteniendo activos desde Supabase..." });

      const allActivos = await loadActivosFromDB((msg) =>
        toast({ title: "Procesando activos", description: msg })
      );

      if (allActivos.length === 0) {
        toast({ title: "Sin datos", description: "No hay activos con codigoactivo <= 43753, estadoinventario con dato, artemisaaltabaja in (0,1) y ultimoregistro=1.", variant: "destructive" });
        return;
      }

      const grupos = new Map();
      allActivos.forEach((a) => {
        const key = String(a.tipoRubroAct ?? a.tiporubroact ?? "").trim();
        const desc = String(rubroFromTipo[key] ?? rubroFromTipo[a.tipoRubroAct] ?? "").trim() || "SIN RUBRO";
        if (!grupos.has(desc)) grupos.set(desc, { saldoInicial: 0, costoAct: 0, depAcum: 0, count: 0 });
        const g = grupos.get(desc);
        g.saldoInicial += toNumber(a.valorInicial ?? a.valorinicial);
        g.costoAct += toNumber(a.saldoInicialExp ?? a.saldoinicial_exp);
        g.depAcum += toNumber(a.depAcumExp ?? a.depacum_exp);
        g.count += 1;
      });
      const rubrosOrdenados = [...grupos.keys()].sort((x, y) => x.localeCompare(y, "es"));

      toast({ title: "Generando Excel", description: `Construyendo reporte con ${rubrosOrdenados.length} rubros...` });

      const dateStr = new Date().toISOString().slice(0, 10);
      const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;
      const sheetData = [
        ["COSTO ACTUALIZADO Y DEPRECIACIÓN - ÓRGANO JUDICIAL"],
        [`Totales por rubro al 01/01/2026 | Total activos: ${allActivos.length}`],
        [`Fecha: ${dateStr}`],
        [],
        ["N°", "Rubro", "Saldo Inicial", "Costo Actualizado", "Depreciación Acumulada Actualizada al 01/01/2026"],
        ...rubrosOrdenados.map((rubro, idx) => {
          const g = grupos.get(rubro);
          return [idx + 1, rubro, round2(g.saldoInicial), round2(g.costoAct), round2(g.depAcum)];
        }),
        [
          "",
          "TOTAL GENERAL",
          round2(rubrosOrdenados.reduce((s, t) => s + grupos.get(t).saldoInicial, 0)),
          round2(rubrosOrdenados.reduce((s, t) => s + grupos.get(t).costoAct, 0)),
          round2(rubrosOrdenados.reduce((s, t) => s + grupos.get(t).depAcum, 0)),
        ],
      ];

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws["!cols"] = [{ wch: 6 }, { wch: 50 }, { wch: 20 }, { wch: 20 }, { wch: 32 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Costo Depreciacion");
      XLSX.writeFile(wb, `Reporte_Costo_Actualizado_Depreciacion_${dateStr}.xlsx`);

      toast({ title: "Reporte generado", description: `Se exportaron ${allActivos.length} activos en ${rubrosOrdenados.length} rubros.` });
    } catch (err) {
      console.error("Error generando Costo Actualizado y Depreciación (Excel)", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
