import { useState, useCallback } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/lib/supabase";
import { toCamelCaseArray } from "@/lib/mapFields";
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

const fmt = (n) =>
  Number(n || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Reporte Costo Actualizado y Depreciación (PDF).
 * Fuente: Supabase (act_activos).
 * Agrupa por RUBRO y suma: valorinicial -> Saldo Inicial,
 * saldoinicial_exp -> Costo Actualizado,
 * depacum_exp -> Depreciación Acumulada Actualizada al 01/01/2026.
 * Alcance: codigoactivo <= 43753, estadoinventario con dato,
 * artemisaaltabaja in (0,1) y ultimoregistro = 1.
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

      toast({ title: "Cargando datos", description: "Obteniendo activos desde Supabase..." });

      const allActivos = await loadActivosFromDB((msg) =>
        toast({ title: "Procesando activos", description: msg })
      );

      if (allActivos.length === 0) {
        toast({ title: "Sin datos", description: "No hay activos con codigoactivo <= 43753, estadoinventario con dato, artemisaaltabaja in (0,1) y ultimoregistro=1.", variant: "destructive" });
        return;
      }

      // Agrupar por RUBRO y sumar las 3 columnas
      const grupos = new Map();
      allActivos.forEach((a) => {
        const key = String(a.tipoRubroAct ?? a.tiporubroact ?? "").trim();
        const desc = String(rubroFromTipo[key] ?? rubroFromTipo[a.tipoRubroAct] ?? "").trim() || "SIN RUBRO";
        if (!grupos.has(desc)) grupos.set(desc, { saldoInicial: 0, costoAct: 0, depAcum: 0, count: 0, tipos: new Set() });
        const g = grupos.get(desc);
        g.saldoInicial += toNumber(a.valorInicial ?? a.valorinicial);
        g.costoAct += toNumber(a.saldoInicialExp ?? a.saldoinicial_exp);
        g.depAcum += toNumber(a.depAcumExp ?? a.depacum_exp);
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
      doc.text(`Totales por rubro al 01/01/2026 | Total activos: ${allActivos.length}`, pageWidth / 2, 21, { align: "center" });

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
