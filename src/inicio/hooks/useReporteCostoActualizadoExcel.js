import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
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

const EXCEL_URL = `${import.meta.env.BASE_URL || "/"}ACT_ActivosArtemisa.xlsx`;

const loadActivosFromExcel = async (onProgress) => {
  const res = await fetch(EXCEL_URL);
  if (!res.ok) throw new Error(`No se pudo leer ${EXCEL_URL} (HTTP ${res.status})`);
  const buf = await res.arrayBuffer();
  onProgress?.("Procesando Excel local (~25MB)...");
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
  if (!rows || rows.length < 2) return [];
  const H = rows[0].map((h) => String(h ?? "").trim());
  const idxTipo = H.indexOf("TipoRubroAct");
  const idxUlt = H.indexOf("UltimoRegistro");
  const idxImp = H.indexOf("Se_Imprime");
  const idxSaldo = H.indexOf("ValorInicial"); // -> columna "Saldo Inicial" del reporte
  const idxCosto = H.indexOf("SaldoInicial_Exp"); // -> columna "Costo Actualizado" del reporte
  const idxDA = H.indexOf("DepAcum_Exp");
  const idxRubroEmb = H.indexOf("Rubro"); // existe si el Excel ya fue completado
  if ([idxTipo, idxUlt, idxImp, idxSaldo, idxCosto, idxDA].some((i) => i < 0)) {
    throw new Error("El Excel no tiene las columnas esperadas (TipoRubroAct, UltimoRegistro, Se_Imprime, ValorInicial, SaldoInicial_Exp, DepAcum_Exp)");
  }
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    if (String(r[idxUlt] ?? "").trim() !== "1") continue;
    if (String(r[idxImp] ?? "").trim() !== "1") continue;
    out.push({
      tipoRubroAct: r[idxTipo],
      rubroExcel: idxRubroEmb >= 0 ? r[idxRubroEmb] : "",
      valorinicial: r[idxSaldo],
      saldoinicial_exp: r[idxCosto],
      depacum_exp: r[idxDA],
    });
    if (out.length % 20000 === 0) await new Promise((rel) => setTimeout(rel, 0));
  }
  return out;
};

const toNumber = (v) => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
};

/**
 * Reporte Costo Actualizado y Depreciación en Excel.
 * Fuente: Excel local public/ACT_ActivosArtemisa.xlsx (hoja ACT_Activos).
 * Agrupa por RUBRO y suma ValorInicial (->Saldo Inicial), SaldoInicial_Exp (->Costo Actualizado) y DepAcum_Exp.
 * Alcance: filas del Excel con UltimoRegistro=1 y Se_Imprime=1 (sin otros filtros).
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

      toast({ title: "Cargando datos", description: "Leyendo Excel local ACT_ActivosArtemisa.xlsx..." });

      const allActivos = await loadActivosFromExcel((msg) =>
        toast({ title: "Procesando Excel", description: msg })
      );

      if (allActivos.length === 0) {
        toast({ title: "Sin datos", description: "El Excel no tiene filas con UltimoRegistro=1 y Se_Imprime=1.", variant: "destructive" });
        return;
      }

      const grupos = new Map();
      allActivos.forEach((a) => {
        const key = String(a.tipoRubroAct ?? "").trim();
        const desc = String(a.rubroExcel ?? "").trim()
          || String(rubroFromTipo[a.tipoRubroAct] ?? rubroFromTipo[key] ?? "").trim()
          || "SIN RUBRO";
        if (!grupos.has(desc)) grupos.set(desc, { saldoInicial: 0, costoAct: 0, depAcum: 0, count: 0 });
        const g = grupos.get(desc);
        g.saldoInicial += toNumber(a.valorinicial);
        g.costoAct += toNumber(a.saldoinicial_exp);
        g.depAcum += toNumber(a.depacum_exp);
        g.count += 1;
      });
      const rubrosOrdenados = [...grupos.keys()].sort((x, y) => x.localeCompare(y, "es"));

      toast({ title: "Generando Excel", description: `Construyendo reporte con ${rubrosOrdenados.length} rubros...` });

      const dateStr = new Date().toISOString().slice(0, 10);
      const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;
      const sheetData = [
        ["COSTO ACTUALIZADO Y DEPRECIACIÓN - ÓRGANO JUDICIAL"],
        [`Totales por rubro al 01/01/2026 | Total activos: ${allActivos.length} (Excel UltimoRegistro=1 y Se_Imprime=1)`],
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
