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

const FALTANTES_DEP_HEADERS = [
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
 * Reporte FALTANTES EN ESTADO ACTIVO (PDF).
 * Misma lógica que ENCONTRADOS EN ESTADO BAJA pero invertida.
 * Criterio: estadoinventario IS NULL OR estadoinventario = ''
 * AND artemisaaltabaja=1 (sin filtro ultimoregistro).
 * En servidor se filtra solo por artemisaaltabaja=1 y el OR
 * NULL/vacío se refuerza en cliente.
 * Columnas básicas: Código Activo, Rubro, Tipo Rubro, Descripción,
 * Ubicación, Responsable y Carnet. Orden: codigoactivo ASC.
 */
export const useReporteFaltantesActivo = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    try {
      toast({ title: "Generando Faltantes en Estado Activo", description: "Cargando catálogos..." });

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

      toast({ title: "Cargando activos", description: "Obteniendo faltantes en estado activo..." });

      const fetchRows = async () => {
        let rows = [];
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
          rows = rows.concat(batch);
          if (batch.length < FETCH_CHUNK) break;
          from += FETCH_CHUNK;
          if (rows.length > 100000) break;
          await new Promise((r) => setTimeout(r, 0));
        }
        return rows;
      };

      let allActivos = await fetchRows();
      // Refuerzo en cliente: estadoinventario NULL o vacío y artemisaaltabaja=1
      allActivos = allActivos.filter((a) => {
        const estInv = String(a.estadoinventario ?? a.estadoInventario ?? "").trim();
        if (estInv !== "") return false;
        const v = a.artemisaaltabaja ?? a.artemisaAltaBaja;
        const codigoActivo = Number(a.codigoActivo ?? a.codigoactivo ?? 0);
        return Number(v) === 1 && codigoActivo <= 43753;
      });
      allActivos.sort((a, b) => Number(a.codigoActivo ?? a.codigoactivo ?? 0) - Number(b.codigoActivo ?? b.codigoactivo ?? 0));

      if (allActivos.length === 0) {
        toast({ title: "Sin datos", description: "No hay activos faltantes en estado activo con ese criterio.", variant: "destructive" });
        return;
      }

      const totales = {
        costoInicial: 0,
        depAcum: 0,
        costoActualizado: 0,
        depActualizada: 0,
        depAcumTotal: 0,
        depPeriodo: 0,
        costoTotal: 0,
        depTotal: 0,
      };

      const body = allActivos.map((a, idx) => {
        const codigoActivo = a.codigoActivo ?? a.codigoactivo;
        const tipoRubroAct = a.tipoRubroAct ?? a.tiporubroact;
        const rubroDesc = rubroFromTipo[tipoRubroAct] ?? rubroFromTipo[String(tipoRubroAct)] ?? "—";
        const tipoDesc = tipoRubroDescMap[tipoRubroAct] ?? tipoRubroDescMap[String(tipoRubroAct)] ?? "—";
        const ambCode = String(a.codigoAmbiente ?? a.codigoambiente ?? "").trim();
        const ciRaw = String(a.cirun ?? "").trim();

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

        totales.costoInicial += costoInicial ?? 0;
        totales.depAcum += depAcum ?? 0;
        totales.costoActualizado += costoActualizado ?? 0;
        totales.depActualizada += depActualizada ?? 0;
        totales.depAcumTotal += depAcumTotal ?? 0;
        totales.depPeriodo += depPeriodo ?? 0;
        totales.costoTotal += costoTotal ?? 0;
        totales.depTotal += depTotal ?? 0;

        return [
          String(idx + 1),
          codigoActivo != null ? `OJ-02-${codigoActivo}` : "—",
          String(rubroDesc || "—"),
          String(tipoDesc || "—"),
          String(a.descripcionActivo ?? a.descripcionactivo ?? "—"),
          String(ubicacionMap[ambCode] || ambCode || "—"),
          String(responsableNameOf(ciRaw)),
          ciRaw || "—",
          fmtMoney(costoInicial),
          fmtMoney(depAcum),
          fmtMoney(costoActualizado),
          fmtMoney(depActualizada),
          fmtMoney(depAcumTotal),
          fmtMes(depMes),
          fmtMoney(depPeriodo),
          fmtMoney(costoTotal),
          fmtMoney(depTotal),
        ];
      });

      toast({ title: "Generando PDF", description: `Construyendo reporte con ${allActivos.length} activos...` });

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      addLogo(doc);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("FALTANTES EN ESTADO ACTIVO - ÓRGANO JUDICIAL", pageWidth / 2, 16, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Total activos: ${allActivos.length}`, pageWidth / 2, 21, { align: "center" });

      autoTable(doc, {
        startY: 26,
        head: [["N°", "Código Activo", "Rubro", "Tipo Rubro", "Descripción", "Ubicación", "Responsable", "Carnet", ...FALTANTES_DEP_HEADERS]],
        body,
        foot: [["", "", "", "", "", "", "TOTAL", String(allActivos.length), fmtMoney(totales.costoInicial), fmtMoney(totales.depAcum), fmtMoney(totales.costoActualizado), fmtMoney(totales.depActualizada), fmtMoney(totales.depAcumTotal), "", fmtMoney(totales.depPeriodo), fmtMoney(totales.costoTotal), fmtMoney(totales.depTotal)]],
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
          5: { cellWidth: 20, halign: "left" },
          6: { cellWidth: 16, halign: "left" },
          7: { cellWidth: 12, halign: "center" },
          8: { cellWidth: 12, halign: "right" },
          9: { cellWidth: 12, halign: "right" },
          10: { cellWidth: 12, halign: "right" },
          11: { cellWidth: 12, halign: "right" },
          12: { cellWidth: 12, halign: "right" },
          13: { cellWidth: 10, halign: "right" },
          14: { cellWidth: 12, halign: "right" },
          15: { cellWidth: 12, halign: "right" },
          16: { cellWidth: 12, halign: "right" },
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

      doc.save("Faltantes_Estado_Activo.pdf");
      toast({ title: "Reporte generado", description: `Se exportaron ${allActivos.length} activos.` });
    } catch (err) {
      console.error("Error generando Faltantes en Estado Activo", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
