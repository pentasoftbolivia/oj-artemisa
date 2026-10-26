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
const addLogo = (doc) => {
  try {
    doc.addImage(LOGO_JPG_DATA_URL, "JPEG", 14, 8, LOGO_W, LOGO_H);
  } catch {}
};

const fmtMoney = (v) => {
  if (v === null || v === undefined || v === "") return "0.00";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtMes = (v) => {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toFixed(8);
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

/**
 * Reporte FALTANTES POR RUBRO (PDF).
 * Misma lógica que FALTANTES EN ESTADO ACTIVO:
 * estadoinventario IS NULL OR estadoinventario = ''
 * AND artemisaaltabaja=1 (sin filtro ultimoregistro).
 * Agrupado por rubro: nombre del rubro + total de activos.
 */
export const useReporteFaltantesPorRubro = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    try {
      toast({ title: "Generando Faltantes por Rubro", description: "Cargando catálogos..." });

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
        // WHERE artemisaaltabaja=1 (el OR NULL/vacío de estadoinventario se filtra en cliente)
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
        const depMes = tasaAnual != null ? Number((tasaAnual / 12).toFixed(8)) : null;
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
      const body = rubrosOrdenados.map((rubro, idx) => {
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
          String(idx + 1),
          rubro,
          String(g.count),
          fmtMoney(g.costoInicial),
          fmtMoney(g.depAcum),
          fmtMoney(g.costoActualizado),
          fmtMoney(g.depActualizada),
          fmtMoney(g.depAcumTotal),
          g.depMes !== null ? fmtMes(g.depMes) : "",
          fmtMoney(g.depPeriodo),
          fmtMoney(g.costoTotal),
          fmtMoney(g.depTotal),
        ];
      });

      toast({ title: "Generando PDF", description: `Construyendo reporte con ${rubrosOrdenados.length} rubros...` });

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      addLogo(doc);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("FALTANTES POR RUBRO - ÓRGANO JUDICIAL", pageWidth / 2, 16, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Total activos: ${allActivos.length} en ${rubrosOrdenados.length} rubros`, pageWidth / 2, 21, { align: "center" });

      autoTable(doc, {
        startY: 26,
        head: [["N°", "Rubro", "Total Activos", ...DEP_HEADERS]],
        body,
        foot: [["", "TOTAL GENERAL", String(totales.count), fmtMoney(totales.costoInicial), fmtMoney(totales.depAcum), fmtMoney(totales.costoActualizado), fmtMoney(totales.depActualizada), fmtMoney(totales.depAcumTotal), "", fmtMoney(totales.depPeriodo), fmtMoney(totales.costoTotal), fmtMoney(totales.depTotal)]],
        showFoot: "lastPage",
        theme: "striped",
        styles: { font: "helvetica", fontSize: 6, cellPadding: 1, overflow: "linebreak", valign: "middle" },
        headStyles: { fillColor: [16, 70, 140], textColor: [255, 255, 255], halign: "center", fontStyle: "bold", fontSize: 6 },
        footStyles: { fillColor: [230, 240, 255], textColor: [16, 70, 140], halign: "center", fontStyle: "bold", fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 7, halign: "center" },
          1: { cellWidth: 24, halign: "left" },
          2: { cellWidth: 12, halign: "center" },
          3: { cellWidth: 12, halign: "right" },
          4: { cellWidth: 12, halign: "right" },
          5: { cellWidth: 12, halign: "right" },
          6: { cellWidth: 12, halign: "right" },
          7: { cellWidth: 12, halign: "right" },
          8: { cellWidth: 10, halign: "right" },
          9: { cellWidth: 12, halign: "right" },
          10: { cellWidth: 12, halign: "right" },
          11: { cellWidth: 12, halign: "right" },
        },
        margin: { top: 26, left: 6, right: 6 },
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

      doc.save("Faltantes_Por_Rubro.pdf");
      toast({ title: "Reporte generado", description: `Se exportaron ${allActivos.length} activos en ${rubrosOrdenados.length} rubros.` });
    } catch (err) {
      console.error("Error generando Faltantes por Rubro", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
