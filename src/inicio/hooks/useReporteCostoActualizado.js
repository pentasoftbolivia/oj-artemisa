import { useState, useCallback } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { getCachedCatalog } from "@/lib/catalogCache";
import { useToast } from "@/hooks/use-toast";
import { LOGO_JPG_DATA_URL } from "@/lib/logoJpgBase64";

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

const LOGO_W = 48;
const LOGO_H = LOGO_W * (57 / 256);
const addLogo = (doc) => {
  try {
    doc.addImage(LOGO_JPG_DATA_URL, "JPEG", 14, 8, LOGO_W, LOGO_H);
  } catch { }
};

const EXCEL_URL = `${import.meta.env.BASE_URL || "/"}ACT_ActivosArtemisa.xlsx`;

// Lee el Excel local (public/ACT_ActivosArtemisa.xlsx, hoja ACT_Activos) y devuelve
// las filas con UltimoRegistro=1 y Se_Imprime=1: { tipoRubroAct, rubroExcel, saldoInicial, costoAct, depAcum }
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

const fmt = (n) =>
  Number(n || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Reporte Costo Actualizado y Depreciación (PDF).
 * Fuente: Excel local public/ACT_ActivosArtemisa.xlsx (hoja ACT_Activos).
 * Agrupa por RUBRO y suma: ValorInicial -> Saldo Inicial,
 * SaldoInicial_Exp -> Costo Actualizado,
 * DepAcum_Exp -> Depreciación Acumulada Actualizada al 01/01/2026.
 * Alcance: filas del Excel con UltimoRegistro=1 y Se_Imprime=1 (sin otros filtros).
 */
export const useReporteCostoActualizado = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    try {
      toast({ title: "Generando Costo Actualizado y Depreciación", description: "Cargando catálogos..." });

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

      // Agrupar por RUBRO y sumar las 3 columnas (usa columna Rubro del Excel si ya fue completado)
      const grupos = new Map();
      allActivos.forEach((a) => {
        const key = String(a.tipoRubroAct ?? "").trim();
        const desc = String(a.rubroExcel ?? "").trim()
          || String(rubroFromTipo[a.tipoRubroAct] ?? rubroFromTipo[key] ?? "").trim()
          || "SIN RUBRO";
        if (!grupos.has(desc)) grupos.set(desc, { saldoInicial: 0, costoAct: 0, depAcum: 0, count: 0, tipos: new Set() });
        const g = grupos.get(desc);
        g.saldoInicial += toNumber(a.valorinicial);
        g.costoAct += toNumber(a.saldoinicial_exp);
        g.depAcum += toNumber(a.depacum_exp);
        g.count += 1;
        if (key) g.tipos.add(key);
      });
      console.debug("[CostoDep] detalle por rubro:", JSON.stringify([...grupos.entries()].map(([rubro, g]) => ({
        rubro, filas: g.count, tipos: [...g.tipos].sort(),
        ValorInicial_como_SaldoInicial: Number(g.saldoInicial.toFixed(2)),
        SaldoInicial_Exp_como_CostoActualizado: Number(g.costoAct.toFixed(2)),
        DepAcum_Exp: Number(g.depAcum.toFixed(2)),
      }))));
      const rubrosOrdenados = [...grupos.keys()].sort((x, y) => x.localeCompare(y, "es"));
      const body = rubrosOrdenados.map((rubro, idx) => {
        const g = grupos.get(rubro);
        return [String(idx + 1), rubro, fmt(g.saldoInicial), fmt(g.costoAct), fmt(g.depAcum)];
      });
      const totSaldoInicial = rubrosOrdenados.reduce((s, t) => s + grupos.get(t).saldoInicial, 0);
      const totCostoAct = rubrosOrdenados.reduce((s, t) => s + grupos.get(t).costoAct, 0);
      const totDepAcum = rubrosOrdenados.reduce((s, t) => s + grupos.get(t).depAcum, 0);

      toast({ title: "Generando PDF", description: `Construyendo reporte con ${rubrosOrdenados.length} rubros...` });

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      addLogo(doc);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("COSTO ACTUALIZADO Y DEPRECIACIÓN - ÓRGANO JUDICIAL", pageWidth / 2, 16, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Totales por rubro al 01/01/2026 | Total activos: ${allActivos.length} (Excel UltimoRegistro=1 y Se_Imprime=1)`, pageWidth / 2, 21, { align: "center" });

      autoTable(doc, {
        startY: 26,
        head: [["N°", "Rubro", "Saldo Inicial", "Costo Actualizado al 01/01/2026", "Depreciación Acumulada Actualizada al 01/01/2026"]],
        body,
        foot: [["", "TOTAL GENERAL", fmt(totSaldoInicial), fmt(totCostoAct), fmt(totDepAcum)]],
        showFoot: "lastPage",
        theme: "striped",
        styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.6, overflow: "linebreak", valign: "middle" },
        headStyles: { fillColor: [16, 70, 140], textColor: [255, 255, 255], halign: "center", fontStyle: "bold", fontSize: 7.5 },
        footStyles: { fillColor: [230, 240, 255], textColor: [16, 70, 140], halign: "center", fontStyle: "bold", fontSize: 7.5 },
        columnStyles: {
          0: { cellWidth: 12, halign: "center" },
          1: { cellWidth: "auto", halign: "left" },
          2: { cellWidth: 42, halign: "right" },
          3: { cellWidth: 42, halign: "right" },
          4: { cellWidth: 55, halign: "right" },
        },
        margin: { left: 10, right: 10, top: 26 },
      });

      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        if (i > 1) addLogo(doc);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80);
        doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 7, { align: "center" });
      }

      doc.save(`Reporte_Costo_Actualizado_Depreciacion.pdf`);
      toast({ title: "Reporte generado", description: `Se exportaron ${allActivos.length} activos en ${rubrosOrdenados.length} rubros.` });
    } catch (err) {
      console.error("Error generando Costo Actualizado y Depreciación", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
