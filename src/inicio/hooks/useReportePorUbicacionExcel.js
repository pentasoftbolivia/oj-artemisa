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

// Mismo orden del reporte POR UBICACION en PDF
const CIUDAD_ORDEN = [
  "EL ALTO",
  "LA PAZ",
  "LA PAZ ZONA SUR",
  "CARANAVI",
  "VIACHA",
  "ACHACACHI",
  "CHULUMANI",
  "COPACABANA",
  "SICA SICA",
  "COROICO",
  "PUCARANI",
  "APOLO",
  "PATACAMAYA",
  "INQUISIVI",
  "CHUMA",
  "ACHOCALLA",
  "GUAQUI",
  "SORATA",
  "CORO CORO",
  "MOCO MOCO",
  "CARABUCO",
  "IXIAMAS",
  "LURIBAY",
  "GUANAY",
  "PUERTO ACOSTA",
  "CHARAZANI",
  "QUIME",
  "LAJA",
  "PALOS BLANCOS",
  "SAN ANDRES DE MACHACA",
  "LA ASUNTA",
  "SAPAHAQUI",
  "COLQUIRI",
];
const ciudadOrdenMap = {};
CIUDAD_ORDEN.forEach((name, idx) => { ciudadOrdenMap[name] = idx; });

/**
 * Genera el Reporte por Ubicación en Excel.
 * Mismos datos y orden que el PDF (ultimoregistro=1, por ciudad y código):
 * [N°, Ciudad, Código Activo, Rubro, Tipo Rubro, Descripción, Ubicación, Responsable, Carnet]
 * Hojas: "Resumen" (totales por ciudad) y "Activos" (detalle).
 */
export const useReportePorUbicacionExcel = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    try {
      toast({ title: "Generando Reporte por Ubicación (Excel)", description: "Cargando catálogos..." });

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
      const tipoRubroDescMap = {};
      const rubroFromTipo = {};
      (tipoRubros || []).forEach((t) => {
        tipoRubroDescMap[t.tiporubroact] = t.descripciontiporubroact;
        tipoRubroDescMap[String(t.tiporubroact)] = t.descripciontiporubroact;
        rubroFromTipo[t.tiporubroact] = rubroDescMap[t.codigorubroact];
        rubroFromTipo[String(t.tiporubroact)] = rubroDescMap[t.codigorubroact];
      });

      const nivelMap = {};
      (niveles || []).forEach((n) => { nivelMap[String(n.codigonivel ?? "").trim()] = n; });
      const inmuebleMap = {};
      (inmuebles || []).forEach((i) => { inmuebleMap[String(i.codigoinmueble ?? "").trim()] = i; });
      const ciudadMap = {};
      (ciudades || []).forEach((c) => { ciudadMap[String(c.codigociudad ?? "").trim()] = c; });

      const ubicacionJerarquiaMap = {};
      const ciudadPorAmbiente = {};
      (ambientes || []).forEach((a) => {
        const code = String(a.codigoambiente ?? "").trim();
        if (!code) return;
        const nivel = nivelMap[String(a.codigonivel ?? "").trim()];
        const inmuebleCode = String(nivel?.codigoinmueble ?? "").trim();
        const inmueble = nivel ? inmuebleMap[inmuebleCode] : null;
        const ciudad = inmueble ? ciudadMap[String(inmueble.codigociudad ?? "").trim()] : null;
        let ciudadDesc = String(ciudad?.descripcion ?? ciudad?.ciudad ?? "").trim().toUpperCase();
        // Mismas reglas especiales del reporte POR UBICACION en PDF
        const esLaPaz2309 = inmuebleCode === "2309" && ciudadDesc === "LA PAZ";
        const esLaPaz2327 = inmuebleCode === "2327" && ciudadDesc === "LA PAZ";
        const esLaPaz2341 = inmuebleCode === "2341" && ciudadDesc === "LA PAZ";
        const esLaPaz2371 = inmuebleCode === "2371" && ciudadDesc === "LA PAZ";
        if (esLaPaz2309) ciudadDesc = "ACHOCALLA";
        else if (esLaPaz2327) ciudadDesc = "LAJA";
        else if (esLaPaz2341) ciudadDesc = "PALOS BLANCOS";
        else if (esLaPaz2371) ciudadDesc = "SAN ANDRES DE MACHACA";
        ciudadPorAmbiente[code] = ciudadDesc || "SIN CIUDAD";
        const ciudadLabelUbic = esLaPaz2309 ? "ACHOCALLA" : esLaPaz2327 ? "LAJA" : esLaPaz2341 ? "PALOS BLANCOS" : esLaPaz2371 ? "SAN ANDRES DE MACHACA" : ciudad?.descripcion;
        ubicacionJerarquiaMap[code] =
          [ciudadLabelUbic, inmueble?.inmueble, nivel?.nivel, a.ambiente]
            .map((s) => (s || "").trim())
            .filter(Boolean)
            .join(" / ") || String(code);
      });

      const responsableMap = {};
      (responsables || []).forEach((r) => {
        const raw = String(r.cirun ?? "").trim();
        responsableMap[raw] = r;
        const norm = normalizeCi(r.cirun);
        if (norm !== raw) responsableMap[norm] = r;
        const loose = normalizeCiLoose(r.cirun);
        if (loose !== raw && loose !== norm) responsableMap[loose] = r;
        const prefix = getCiPrefix(raw);
        if (prefix && prefix !== raw && prefix !== norm && prefix !== loose) responsableMap[prefix] = r;
      });
      const resolveResponsableName = (cirun) => {
        const rawCi = String(cirun ?? "").trim();
        if (!rawCi) return "—";
        const normCi = normalizeCi(rawCi);
        const looseCi = normalizeCiLoose(rawCi);
        const prefixCi = getCiPrefix(rawCi);
        const resp = responsableMap[normCi] || responsableMap[looseCi] || responsableMap[prefixCi] || responsableMap[rawCi];
        if (!resp) return rawCi || "—";
        return [resp.nombre1, resp.nombre2, resp.paterno, resp.materno].map((s) => (s || "").trim()).filter(Boolean).join(" ") || resp.cirun;
      };

      toast({ title: "Cargando activos", description: "Obteniendo activos con ultimoregistro=1..." });

      let allActivos = [];
      let from = 0;
      const FETCH_CHUNK = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("act_activos")
          .select(ACTIVO_COLUMNS)
          .eq("ultimoregistro", 1).order("codigoactivointerno", { ascending: true }).range(from, from + FETCH_CHUNK - 1);
        if (error) throw error;
        const batch = toCamelCaseArray(data || []);
        if (batch.length === 0) break;
        allActivos = allActivos.concat(batch);
        if (batch.length < FETCH_CHUNK) break;
        from += FETCH_CHUNK;
        if (allActivos.length > 60000) break;
        await new Promise((r) => setTimeout(r, 0));
      }

      if (allActivos.length === 0) {
        toast({ title: "Sin datos", description: "No hay activos con ultimoregistro=1.", variant: "destructive" });
        return;
      }

      // Mismo orden que el PDF: ciudad según CIUDAD_ORDEN, luego código ascendente
      allActivos.sort((a, b) => {
        const ambA = String(a.codigoAmbiente ?? "").trim();
        const ambB = String(b.codigoAmbiente ?? "").trim();
        const ciuA = (ciudadPorAmbiente[ambA] || "SIN CIUDAD").toUpperCase();
        const ciuB = (ciudadPorAmbiente[ambB] || "SIN CIUDAD").toUpperCase();
        const idxA = ciudadOrdenMap[ciuA] ?? 999;
        const idxB = ciudadOrdenMap[ciuB] ?? 999;
        if (idxA !== idxB) return idxA - idxB;
        if (idxA === 999 && idxB === 999) {
          const cmpCiu = ciuA.localeCompare(ciuB, "es");
          if (cmpCiu !== 0) return cmpCiu;
        }
        const codA = String(a.codigoActivo ?? "").trim();
        const codB = String(b.codigoActivo ?? "").trim();
        const numA = Number(codA.replace(/\D/g, ""));
        const numB = Number(codB.replace(/\D/g, ""));
        if (numA && numB && numA !== numB) return numA - numB;
        return codA.localeCompare(codB, "es", { numeric: true });
      });

      const grupos = new Map();
      allActivos.forEach((a) => {
        const ambCode = String(a.codigoAmbiente ?? "").trim();
        const ciudad = (ciudadPorAmbiente[ambCode] || "SIN CIUDAD").toUpperCase();
        const label = ciudad === "SIN CIUDAD" ? "SIN CIUDAD" : CIUDAD_ORDEN.find((c) => c === ciudad) || ciudad;
        if (!grupos.has(label)) grupos.set(label, []);
        grupos.get(label).push(a);
      });
      const ordenCiudades = [
        ...CIUDAD_ORDEN.filter((c) => grupos.has(c)),
        ...[...grupos.keys()].filter((c) => !(c in ciudadOrdenMap)).sort((a, b) => a.localeCompare(b, "es")),
      ];

      toast({ title: "Generando Excel", description: `Construyendo reporte con ${allActivos.length} activos en ${ordenCiudades.length} ciudades...` });

      const dateStr = new Date().toISOString().slice(0, 10);
      const rowOf = (a, n) => {
        const tipoDesc = tipoRubroDescMap[a.tipoRubroAct] ?? tipoRubroDescMap[String(a.tipoRubroAct)] ?? "—";
        const rubroDesc = rubroFromTipo[a.tipoRubroAct] ?? rubroFromTipo[String(a.tipoRubroAct)] ?? "—";
        const ambCode = String(a.codigoAmbiente ?? "").trim();
        const ciudad = (ciudadPorAmbiente[ambCode] || "SIN CIUDAD").toUpperCase();
        const label = ciudad === "SIN CIUDAD" ? "SIN CIUDAD" : CIUDAD_ORDEN.find((c) => c === ciudad) || ciudad;
        const ubicacion = ubicacionJerarquiaMap[ambCode] || ambCode || "—";
        const responsableName = resolveResponsableName(a.cirun);
        const ci = String(a.cirun ?? "").trim() || "—";
        const codigoFormateado = a.codigoActivo != null ? `OJ-02-${a.codigoActivo}` : "—";
        const descripcion = String(a.descripcionActivo ?? a.descripcionactivo ?? "—").replace(/\s+/g, " ").trim() || "—";
        return [n, label, codigoFormateado, rubroDesc, tipoDesc, descripcion, ubicacion, responsableName, ci];
      };

      // Hoja Resumen
      const resumenRows = ordenCiudades.map((c, idx) => [idx + 1, c, (grupos.get(c) || []).length]);
      const resumenSheet = [
        ["REPORTE POR UBICACIÓN - RESUMEN POR CIUDAD - ÓRGANO JUDICIAL"],
        [`Total activos: ${allActivos.length} (ultimoregistro=1)`],
        [`Fecha: ${dateStr}`],
        [],
        ["#", "Ciudad", "Total Activos"],
        ...resumenRows,
        ["", "TOTAL GENERAL", allActivos.length],
      ];

      // Hoja Activos (detalle en el mismo orden del PDF)
      let n = 0;
      const detalleRows = [];
      ordenCiudades.forEach((c) => {
        (grupos.get(c) || []).forEach((a) => {
          n += 1;
          detalleRows.push(rowOf(a, n));
        });
      });
      const detalleSheet = [
        ["REPORTE POR UBICACIÓN - ÓRGANO JUDICIAL"],
        [`Total activos: ${allActivos.length} (ultimoregistro=1, ordenados por ciudad y código)`],
        [`Fecha: ${dateStr}`],
        [],
        ["N°", "Ciudad", "Código Activo", "Rubro", "Tipo Rubro", "Descripción del Activo", "Ubicación", "Responsable", "Carnet"],
        ...detalleRows,
      ];

      const wb = XLSX.utils.book_new();
      const wsResumen = XLSX.utils.aoa_to_sheet(resumenSheet);
      wsResumen["!cols"] = [{ wch: 6 }, { wch: 30 }, { wch: 16 }];
      const wsDetalle = XLSX.utils.aoa_to_sheet(detalleSheet);
      wsDetalle["!cols"] = [{ wch: 7 }, { wch: 24 }, { wch: 16 }, { wch: 28 }, { wch: 28 }, { wch: 50 }, { wch: 55 }, { wch: 30 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");
      XLSX.utils.book_append_sheet(wb, wsDetalle, "Activos");
      XLSX.writeFile(wb, `Reporte_Por_Ubicacion_${dateStr}.xlsx`);

      toast({ title: "Reporte generado", description: `Se exportaron ${allActivos.length} activos en ${ordenCiudades.length} ciudades.` });
    } catch (err) {
      console.error("Error generando Reporte por Ubicación (Excel)", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
