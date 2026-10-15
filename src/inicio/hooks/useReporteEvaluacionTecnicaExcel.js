import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { getCachedCatalog } from "@/lib/catalogCache";
import { toCamelCaseArray } from "@/lib/mapFields";
import { useToast } from "@/hooks/use-toast";
import { ACTIVO_COLUMNS } from "@/lib/activoColumns";
import { normalizeCi, normalizeCiLoose, getCiPrefix } from "../constants/inventarioConstants";

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

const clean = (v) => String(v ?? "").replace(/\s+/g, " ").trim() || "—";

const HEADERS = [
  "N°", "Código Activo", "Rubro", "Tipo Rubro", "Descripción", "Conservación",
  "Responsable", "Carnet", "Estado", "Ciudad", "Inmueble",
  "Nivel", "Ambiente", "Observaciones",
];

const getEstadoAltaBajaLabel = (v) => {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "1" || s === "TRUE" || s === "ALTA") return "Alta";
  if (s === "0" || s === "FALSE" || s === "BAJA") return "Baja";
  return s || "—";
};

/**
 * Reporte FICHA DE EVALUACION TECNICA en Excel — PRODUCTO 4.
 * Criterio: estado=1 AND ultimoregistro=1 AND estadoinventario con dato
 * (sin filtro pararevaluo, incluye estadoconservacion=MALO).
 * Mismas columnas de la ficha PDF, sin cotizaciones, respaldos ni factores.
 * Orden: codigoactivo ASC.
 */
export const useReporteEvaluacionTecnicaExcel = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    try {
      toast({ title: "Generando Evaluación Técnica (Excel)", description: "Cargando catálogos..." });

      const [rubros, tipoRubros, ambientes, responsables, ciudades, inmuebles, niveles] = await Promise.all([
        getCachedCatalog("act_rubro"),
        getCachedCatalog("act_tiporubro"),
        getCachedCatalog("act_ambiente"),
        getCachedCatalog("act_responsable"),
        getCachedCatalog("act_ciudad"),
        getCachedCatalog("act_inmueble"),
        getCachedCatalog("act_nivel"),
      ]);

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
      const ubicacionPartsMap = {};
      (ambientes || []).forEach((a) => {
        const code = String(a.codigoambiente ?? "").trim();
        if (!code) return;
        const nivel = nivelMap[String(a.codigonivel ?? "").trim()];
        const inmueble = nivel ? inmuebleMap[String(nivel.codigoinmueble ?? "").trim()] : null;
        const ciudad = inmueble ? ciudadMap[String(inmueble.codigociudad ?? "").trim()] : null;
        ubicacionPartsMap[code] = {
          ciudad: String(ciudad?.descripcion ?? "").trim(),
          inmueble: String(inmueble?.inmueble ?? "").trim(),
          nivel: String(nivel?.nivel ?? "").trim(),
          ambiente: String(a.ambiente ?? "").trim(),
        };
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

      toast({ title: "Cargando activos", description: "Obteniendo activos (estado=1, ultimoregistro=1)..." });

      let allActivos = [];
      {
        let from = 0;
        const FETCH_CHUNK = 1000;
        while (true) {
          const { data, error } = await supabase
            .from("act_activos")
            .select(ACTIVO_COLUMNS)
            .eq("estado", 1)
            .eq("ultimoregistro", 1)
            .not("estadoinventario", "is", null)
            .neq("estadoinventario", "")
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
      }
      // Refuerzo en cliente (sin filtro pararevaluo, incluye MALO)
      allActivos = allActivos.filter((a) => {
        const est = a.estado ?? a.estadoActivo;
        const esAlta =
          est === 1 || est === true
            ? true
            : ["1", "TRUE", "T", "ALTA"].includes(String(est ?? "").trim().toUpperCase());
        if (!esAlta) return false;
        if (String(a.ultimoRegistro ?? a.ultimoregistro ?? "").trim() !== "1") return false;
        return String(a.estadoInventario ?? a.estadoinventario ?? "").trim() !== "";
      });
      allActivos.sort((a, b) => Number(a.codigoActivo ?? a.codigoactivo ?? 0) - Number(b.codigoActivo ?? b.codigoactivo ?? 0));

      if (allActivos.length === 0) {
        toast({ title: "Sin datos", description: "No hay activos con ese criterio.", variant: "destructive" });
        return;
      }

      toast({ title: "Generando Excel", description: `Construyendo reporte con ${allActivos.length} activos...` });

      const dateStr = new Date().toISOString().slice(0, 10);
      const rows = allActivos.map((a, idx) => {
        const codigoActivo = a.codigoActivo ?? a.codigoactivo;
        const tipoRubroAct = a.tipoRubroAct ?? a.tiporubroact;
        const rubroDesc = rubroFromTipo[tipoRubroAct] ?? rubroFromTipo[String(tipoRubroAct)] ?? "";
        const ambCode = String(a.codigoAmbiente ?? a.codigoambiente ?? "").trim();
        const ciRaw = String(a.cirun ?? "").trim();
        const estadoCons = String(a.estadoConservacion ?? a.estadoconservacion ?? "").trim().toUpperCase();
        const parts = ubicacionPartsMap[ambCode] || { ciudad: "", inmueble: "", nivel: "", ambiente: "" };
        return [
          idx + 1,
          codigoActivo != null ? `OJ-02-${codigoActivo}` : "—",
          clean(rubroDesc),
          clean(tipoRubroDescMap[tipoRubroAct] ?? tipoRubroDescMap[String(tipoRubroAct)]),
          clean(a.descripcionActivo ?? a.descripcionactivo),
          estadoCons || "—",
          clean(responsableNameOf(ciRaw)),
          ciRaw || "—",
          getEstadoAltaBajaLabel(a.estado ?? a.estadoActivo),
          clean(parts.ciudad),
          clean(parts.inmueble),
          clean(parts.nivel),
          clean(parts.ambiente),
          clean(a.observaciones),
        ];
      });

      const sheetData = [
        ["FICHA DE EVALUACION TECNICA - ÓRGANO JUDICIAL"],
        [`Total activos: ${allActivos.length} (estado=1, ultimoregistro=1)`],
        [`Fecha: ${dateStr}`],
        [],
        HEADERS,
        ...rows,
      ];

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws["!cols"] = [{ wch: 6 }, { wch: 16 }, { wch: 28 }, { wch: 30 }, { wch: 70 }, { wch: 14 }, { wch: 32 }, { wch: 16 }, { wch: 10 }, { wch: 24 }, { wch: 30 }, { wch: 24 }, { wch: 30 }, { wch: 70 }];
      ws["!pageSetup"] = { orientation: "landscape", paperSize: 1, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
      ws["!margins"] = { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "EvaluacionTecnica");
      XLSX.writeFile(wb, `Ficha_Evaluacion_Tecnica_${dateStr}.xlsx`);

      toast({ title: "Reporte generado", description: `Se exportaron ${allActivos.length} fichas de evaluación técnica.` });
    } catch (err) {
      console.error("Error generando Evaluación Técnica (Excel)", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
