import { useState, useCallback } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/lib/supabase";
import { getCachedCatalog } from "@/lib/catalogCache";
import { toCamelCaseArray } from "@/lib/mapFields";
import { useToast } from "@/hooks/use-toast";
import { LOGO_JPG_DATA_URL } from "@/lib/logoJpgBase64";
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

const LOGO_W = 32;
const LOGO_H = LOGO_W * (57 / 256);

const fmtMoneyDep = (v) =>
  Number(v || 0).toLocaleString("es-BO", { minimumFractionDigits: 4, maximumFractionDigits: 4 });

const fmtMesDep = (v) =>
  v === null || v === undefined
    ? "—"
    : Number(v).toLocaleString("es-BO", { minimumFractionDigits: 8, maximumFractionDigits: 8 });

const parseNumDep = (v) => {
  if (v === null || v === undefined || String(v).trim() === "") return 0;
  const n = Number(String(v).replace(",", "."));
  return isNaN(n) ? 0 : n;
};

const addLogo = (doc) => {
  try {
    doc.addImage(LOGO_JPG_DATA_URL, "JPEG", 14, 8, LOGO_W, LOGO_H);
  } catch {
    // El logo es opcional: si falla, el reporte se genera igual.
  }
};

/**
 * Reporte DEPRECIACION POR RUBRO (PDF).
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
export const useReporteDepreciacionPorRubro = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async (options = {}) => {
    const recalcular = !!options?.recalcular;
    setIsGenerating(true);
    try {
      toast({ title: recalcular ? "Generando Depreciación por Rubro Recalculada" : "Generando Depreciación por Rubro", description: "Cargando catálogos..." });

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
      const body = rubrosOrdenados.map((rubro, idx) => {
        const g = grupos.get(rubro);
        if (recalcular) {
          return [
            String(idx + 1),
            rubro,
            String(g.activos),
            fmtMoneyDep(g.costoTotal0910),
            fmtMoneyDep(g.revaluo),
            fmtMoneyDep(g.depTotal),
            fmtMoneyDep(g.valorNeto),
          ];
        }
        return [
          String(idx + 1),
          rubro,
          String(g.activos),
          fmtMoneyDep(g.saldoInicial),
          fmtMoneyDep(g.depAcum),
          fmtMoneyDep(g.costoAct),
          fmtMoneyDep(g.depActualizada),
          fmtMoneyDep(g.depAcumTotal),
          fmtMesDep(g.depMes),
          fmtMoneyDep(g.depPeriodo),
          fmtMoneyDep(g.costoTotal0910),
          fmtMoneyDep(g.revaluo),
          fmtMoneyDep(g.costoTotalRevaluado),
          fmtMoneyDep(g.depTotal),
          fmtMoneyDep(g.valorNeto),
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

      toast({ title: "Generando PDF", description: `Construyendo reporte con ${rubrosOrdenados.length} rubros...` });

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      addLogo(doc);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(recalcular ? "RECALCULAR DEPRECIACION POR RUBRO - ÓRGANO JUDICIAL" : "DEPRECIACION POR RUBRO - ÓRGANO JUDICIAL", pageWidth / 2, 16, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Total activos: ${allActivos.length}`, pageWidth / 2, 21, { align: "center" });

      const headers = recalcular
        ? ["N°", "Rubro", "Activos", "Costo Total Actualizado al 09/10/2026", "Revaluo", "Depreciacion Total", "Valor Neto"]
        : ["N°", "Rubro", "Activos", "Costo Inicial al 31/12/2025", "Depreciacion Acumulada al 31/12/2025", "Costo Actualizado", "Depreciacion Actualizada", "Depreciacion Acumulado Total", "%Dep. Mes", "Depreciacion del Periodo", "Costo Total Actualizado al 09/10/2026", "Revaluo", "Costo Total Actualizado Revaluado", "Depreciacion Total", "Valor Neto"];
      const footRow = recalcular
        ? [
            "",
            "TOTAL GENERAL",
            String(tot.activos),
            fmtMoneyDep(tot.costoTotal0910),
            fmtMoneyDep(tot.revaluo),
            fmtMoneyDep(tot.depTotal),
            fmtMoneyDep(tot.valorNeto),
          ]
        : [
            "",
            "TOTAL GENERAL",
            String(tot.activos),
            fmtMoneyDep(tot.saldoInicial),
            fmtMoneyDep(tot.depAcum),
            fmtMoneyDep(tot.costoAct),
            fmtMoneyDep(tot.depActualizada),
            fmtMoneyDep(tot.depAcumTotal),
            "",
            fmtMoneyDep(tot.depPeriodo),
            fmtMoneyDep(tot.costoTotal0910),
            fmtMoneyDep(tot.revaluo),
            fmtMoneyDep(tot.costoTotalRevaluado),
            fmtMoneyDep(tot.depTotal),
            fmtMoneyDep(tot.valorNeto),
          ];
      const columnStyles = recalcular
        ? {
            0: { cellWidth: 10, halign: "center" },
            1: { cellWidth: 75, halign: "left" },
            2: { cellWidth: 15, halign: "center" },
            3: { cellWidth: 45, halign: "right" },
            4: { cellWidth: 40, halign: "right" },
            5: { cellWidth: 40, halign: "right" },
            6: { cellWidth: 38, halign: "right" },
          }
        : {
            0: { cellWidth: 7, halign: "center" },
            1: { cellWidth: 30, halign: "left" },
            2: { cellWidth: 9, halign: "center" },
            3: { cellWidth: 20, halign: "right" },
            4: { cellWidth: 20, halign: "right" },
            5: { cellWidth: 17, halign: "right" },
            6: { cellWidth: 18, halign: "right" },
            7: { cellWidth: 18, halign: "right" },
            8: { cellWidth: 12, halign: "right" },
            9: { cellWidth: 18, halign: "right" },
            10: { cellWidth: 20, halign: "right" },
            11: { cellWidth: 17, halign: "right" },
            12: { cellWidth: 22, halign: "right" },
            13: { cellWidth: 18, halign: "right" },
            14: { cellWidth: 17, halign: "right" },
          };
      autoTable(doc, {
        startY: 26,
        head: [headers],
        body,
        foot: [footRow],
        showFoot: "lastPage",
        theme: "striped",
        styles: { font: "helvetica", fontSize: recalcular ? 8 : 6, cellPadding: recalcular ? 1.8 : 1, overflow: "linebreak", valign: "middle" },
        headStyles: { fillColor: [16, 70, 140], textColor: [255, 255, 255], halign: "center", fontStyle: "bold", fontSize: recalcular ? 8 : 6 },
        footStyles: { fillColor: [230, 240, 255], textColor: [16, 70, 140], halign: "right", fontStyle: "bold", fontSize: recalcular ? 8 : 6 },
        columnStyles,
        margin: { top: 26, left: 8, right: 8 },
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

      doc.save(recalcular ? "Recalcular_Depreciacion_Por_Rubro.pdf" : "Depreciacion_Por_Rubro.pdf");
      toast({ title: "Reporte generado", description: `Se exportaron ${allActivos.length} activos en ${rubrosOrdenados.length} rubros.` });
    } catch (err) {
      console.error("Error generando Depreciación por Rubro", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
