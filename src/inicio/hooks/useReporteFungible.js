import { useState, useCallback } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/lib/supabase";
import { getCachedCatalog } from "@/lib/catalogCache";
import { toCamelCaseArray } from "@/lib/mapFields";
import { useToast } from "@/hooks/use-toast";
import { LOGO_JPG_DATA_URL } from "@/lib/logoJpgBase64";
import { ACTIVO_COLUMNS } from "@/lib/activoColumns";
import { normalizeCi, normalizeCiLoose, getCiPrefix } from "../constants/inventarioConstants";
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

const fmtMoneyBE = (v) =>
  v === null || v === undefined
    ? "—"
    : Number(v).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtMesBE = (v) =>
  v === null || v === undefined
    ? "—"
    : Number(v).toLocaleString("es-BO", { minimumFractionDigits: 8, maximumFractionDigits: 8 });

const fmtPerBE = (v) =>
  v === null || v === undefined
    ? "—"
    : Number(v).toLocaleString("es-BO", { minimumFractionDigits: 7, maximumFractionDigits: 7 });

const parseNumBE = (v) => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(String(v).replace(",", "."));
  return isNaN(n) ? null : n;
};
const addLogo = (doc) => {
  try {
    doc.addImage(LOGO_JPG_DATA_URL, "JPEG", 14, 8, LOGO_W, LOGO_H);
  } catch {}
};

/**
 * Reporte FUNGIBLE (PDF) — PRODUCTO 3.
 * Mismo detalle que ACTIVOS DE BAJA.
 * Criterio: ultimoregistro=1 AND esactivo=false.
 * Columnas tras Carnet: Costo Inicial al 31/12/2025 (saldoinicial_exp),
 * Depreciacion Acumulada al 31/12/2025 (depacum_exp), Costo Actualizado (pordepanu),
 * Depreciacion Actualizada (actdepacum_exp), Depreciacion Acumulado Total (depacumtotal_exp),
 * %Dep. Mes (tasa_anual/12, 8 decimales), Dep. Periodo ((%Dep.Mes*10)*Costo Total Actualizado),
 * Costo Total Actualizado al 09/10/2026 (costactuali_exp),
 * Revaluo (valorrevaluo), Costo Total Actualizado Revaluado (Costo0910 + Revaluo),
 * Depreciacion Total (depacumtotal_exp + Dep. Periodo),
 * Valor Neto (Costo Revaluado - Dep. Total).
 * Orden: codigoactivo ASC.
 */
export const useReporteFungible = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    try {
      toast({ title: "Generando Fungible", description: "Cargando catálogos..." });

      const [rubros, tipoRubros, ambientes, responsables, ciudades, inmuebles, niveles, paramDep] = await Promise.all([
        getCachedCatalog("act_rubro"),
        getCachedCatalog("act_tiporubro"),
        getCachedCatalog("act_ambiente"),
        getCachedCatalog("act_responsable"),
        getCachedCatalog("act_ciudad"),
        getCachedCatalog("act_inmueble"),
        getCachedCatalog("act_nivel"),
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
      const tipoRubroDescMap = {};
      (tipoRubros || []).forEach((t) => {
        rubroFromTipo[t.tiporubroact] = rubroDescMap[t.codigorubroact];
        rubroFromTipo[String(t.tiporubroact)] = rubroDescMap[t.codigorubroact];
        tipoRubroDescMap[t.tiporubroact] = t.descripciontiporubroact;
        tipoRubroDescMap[String(t.tiporubroact)] = t.descripciontiporubroact;
      });

      const nivelMap = {};
      (niveles || []).forEach((n) => { nivelMap[String(n.codigonivel ?? "").trim()] = n; });
      const inmuebleMap = {};
      (inmuebles || []).forEach((i) => { inmuebleMap[String(i.codigoinmueble ?? "").trim()] = i; });
      const ciudadMap = {};
      (ciudades || []).forEach((c) => { ciudadMap[String(c.codigociudad ?? "").trim()] = c; });
      const ubicacionMap = {};
      (ambientes || []).forEach((a) => {
        const code = String(a.codigoambiente ?? "").trim();
        if (!code) return;
        const nivel = nivelMap[String(a.codigonivel ?? "").trim()];
        const inmueble = nivel ? inmuebleMap[String(nivel.codigoinmueble ?? "").trim()] : null;
        const ciudad = inmueble ? ciudadMap[String(inmueble.codigociudad ?? "").trim()] : null;
        ubicacionMap[code] =
          [ciudad?.descripcion, inmueble?.inmueble, nivel?.nivel, a.ambiente]
            .map((s) => (s || "").trim())
            .filter(Boolean)
            .join(" / ") || code;
      });

      const respMap = {};
      (responsables || []).forEach((r) => {
        const raw = String(r.cirun ?? "").trim();
        respMap[raw] = r;
        const norm = normalizeCi(r.cirun);
        if (norm !== raw) respMap[norm] = r;
        const loose = normalizeCiLoose(r.cirun);
        if (loose !== raw && loose !== norm) respMap[loose] = r;
        const prefix = getCiPrefix(raw);
        if (prefix && prefix !== raw && prefix !== norm && prefix !== loose) respMap[prefix] = r;
      });
      const responsableNameOf = (cirun) => {
        const rawCi = String(cirun ?? "").trim();
        if (!rawCi) return "—";
        const resp =
          respMap[normalizeCi(rawCi)] || respMap[normalizeCiLoose(rawCi)] ||
          respMap[getCiPrefix(rawCi)] || respMap[rawCi];
        if (!resp) return rawCi;
        return (
          [resp.nombre1, resp.nombre2, resp.paterno, resp.materno]
            .map((s) => (s || "").trim())
            .filter(Boolean)
            .join(" ") || resp.cirun
        );
      };

      toast({ title: "Cargando activos", description: "Obteniendo activos fungibles (esactivo=false)..." });

      const fetchFungibles = async () => {
        let rows = [];
        let from = 0;
        const FETCH_CHUNK = 1000;
        while (true) {
          const { data, error } = await supabase
            .from("act_activos")
            .select(`${ACTIVO_COLUMNS},esactivo,saldoinicial_exp,depacum_exp,pordepanu,actdepacum_exp,depacumtotal_exp,costactuali_exp,valorrevaluo`)
            .eq("ultimoregistro", 1)
            .eq("esactivo", false)
            .order("codigoactivo", { ascending: true })
            .range(from, from + FETCH_CHUNK - 1);
          if (error) throw error;
          const batch = toCamelCaseArray(data || []);
          if (batch.length === 0) break;
          rows = rows.concat(batch);
          if (batch.length < FETCH_CHUNK) break;
          from += FETCH_CHUNK;
          if (rows.length > 100000) break;
          await new Promise((r) => setTimeout(r, 0));
        }
        return rows;
      };

      let allActivos = await fetchFungibles();
      // Refuerzo en cliente: esactivo false/0
      allActivos = allActivos.filter((a) => {
        const rawEa = a.esactivo ?? a.esActivo;
        if (rawEa == null || String(rawEa).trim() === "") return false;
        const ea = String(rawEa).trim().toUpperCase();
        return ea === "FALSE" || ea === "0" || ea === "F";
      });
      allActivos.sort((a, b) => Number(a.codigoActivo ?? a.codigoactivo ?? 0) - Number(b.codigoActivo ?? b.codigoactivo ?? 0));

      if (allActivos.length === 0) {
        toast({ title: "Sin datos", description: "No hay activos fungibles con ese criterio.", variant: "destructive" });
        return;
      }

      const body = allActivos.map((a, idx) => {
        const codigoActivo = a.codigoActivo ?? a.codigoactivo;
        const tipoRubroAct = a.tipoRubroAct ?? a.tiporubroact;
        const rubroDesc = rubroFromTipo[tipoRubroAct] ?? rubroFromTipo[String(tipoRubroAct)] ?? "—";
        const tipoDesc = tipoRubroDescMap[tipoRubroAct] ?? tipoRubroDescMap[String(tipoRubroAct)] ?? "—";
        const ambCode = String(a.codigoAmbiente ?? a.codigoambiente ?? "").trim();
        const ciRaw = String(a.cirun ?? "").trim();
        const costoInicial = parseNumBE(a.saldoInicialExp ?? a.saldoinicial_exp);
        const depAcum = parseNumBE(a.depAcumExp ?? a.depacum_exp);
        const costoActualizado = parseNumBE(a.porDepAnu ?? a.pordepanu);
        const depActualizada = parseNumBE(a.actDepAcumExp ?? a.actdepacum_exp);
        const depAcumTotal = parseNumBE(a.depAcumTotalExp ?? a.depacumtotal_exp);
        const tasaAnual = resolveTasaFromParams(rubroDesc, paramTasaMap);
        const depMesRaw = tasaAnual !== null && tasaAnual !== undefined ? tasaAnual / 12 : null;
        const depMes = depMesRaw !== null && depMesRaw !== undefined ? Number(depMesRaw.toFixed(8)) : null;
        const costoTotal0910 = parseNumBE(a.costActualiExp ?? a.costactuali_exp);
        const depPeriodo = depMes !== null && costoTotal0910 !== null ? (depMes * 10) * costoTotal0910 : null;
        const revaluo = parseNumBE(a.valorRevaluo ?? a.valorrevaluo);
        const costoTotalRevaluado = costoTotal0910 !== null && revaluo !== null ? costoTotal0910 + revaluo : null;
        const depTotal = depAcumTotal !== null && depPeriodo !== null ? depAcumTotal + depPeriodo : null;
        const valorNeto = costoTotalRevaluado !== null && depTotal !== null ? costoTotalRevaluado - depTotal : null;
        return [
          String(idx + 1),
          codigoActivo != null ? `OJ-02-${codigoActivo}` : "—",
          String(rubroDesc || "—"),
          String(tipoDesc || "—"),
          String(a.descripcionActivo ?? a.descripcionactivo ?? "—"),
          String(ubicacionMap[ambCode] || ambCode || "—"),
          String(responsableNameOf(ciRaw)),
          ciRaw || "—",
          fmtMoneyBE(costoInicial),
          fmtMoneyBE(depAcum),
          fmtMoneyBE(costoActualizado),
          fmtMoneyBE(depActualizada),
          fmtMoneyBE(depAcumTotal),
          fmtMesBE(depMes),
          fmtPerBE(depPeriodo),
          fmtMoneyBE(costoTotal0910),
          fmtMoneyBE(revaluo),
          fmtMoneyBE(costoTotalRevaluado),
          fmtMoneyBE(depTotal),
          fmtMoneyBE(valorNeto),
        ];
      });

      toast({ title: "Generando PDF", description: `Construyendo reporte con ${allActivos.length} activos...` });

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      addLogo(doc);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("FUNGIBLE - ÓRGANO JUDICIAL", pageWidth / 2, 16, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Total activos fungibles: ${allActivos.length}`, pageWidth / 2, 21, { align: "center" });

      autoTable(doc, {
        startY: 26,
        head: [["N°", "Código Activo", "Rubro", "Tipo Rubro", "Descripción", "Ubicación", "Responsable", "Carnet", "Costo Inicial al 31/12/2025", "Dep. Acumulada al 31/12/2025", "Costo Actualizado", "Dep. Actualizada", "Dep. Acum. Total", "%Dep. Mes", "Dep. Periodo", "Costo Total Actualizado al 09/10/2026", "Revaluo", "Costo Total Actualizado Revaluado", "Dep. Total", "Valor Neto"]],
        body,
        foot: [["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "TOTAL", String(allActivos.length)]],
        showFoot: "lastPage",
        theme: "striped",
        styles: { font: "helvetica", fontSize: 6, cellPadding: 1, overflow: "linebreak", valign: "middle" },
        headStyles: { fillColor: [16, 70, 140], textColor: [255, 255, 255], halign: "center", fontStyle: "bold", fontSize: 6 },
        footStyles: { fillColor: [230, 240, 255], textColor: [16, 70, 140], halign: "center", fontStyle: "bold", fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 7, halign: "center" },
          1: { cellWidth: 12, halign: "center" },
          2: { cellWidth: 12, halign: "left" },
          3: { cellWidth: 12, halign: "left" },
          4: { cellWidth: 26, halign: "left" },
          5: { cellWidth: 14, halign: "left" },
          6: { cellWidth: 12, halign: "left" },
          7: { cellWidth: 10, halign: "center" },
          8: { cellWidth: 12, halign: "right" },
          9: { cellWidth: 12, halign: "right" },
          10: { cellWidth: 11, halign: "right" },
          11: { cellWidth: 12, halign: "right" },
          12: { cellWidth: 12, halign: "right" },
          13: { cellWidth: 12, halign: "right" },
          14: { cellWidth: 12, halign: "right" },
          15: { cellWidth: 13, halign: "right" },
          16: { cellWidth: 12, halign: "right" },
          17: { cellWidth: 13, halign: "right" },
          18: { cellWidth: 12, halign: "right" },
          19: { cellWidth: 12, halign: "right" },
        },
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

      doc.save("Fungible.pdf");
      toast({ title: "Reporte generado", description: `Se exportaron ${allActivos.length} activos fungibles.` });
    } catch (err) {
      console.error("Error generando Fungible", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
