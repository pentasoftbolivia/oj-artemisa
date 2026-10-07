import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { getCachedCatalog } from "@/lib/catalogCache";
import { toCamelCaseArray } from "@/lib/mapFields";
import { useToast } from "@/hooks/use-toast";
import { ACTIVO_COLUMNS } from "@/lib/activoColumns";
import { normalizeCi, normalizeCiLoose, getCiPrefix, CIUDADES_EXCEPCION_SET } from "../constants/inventarioConstants";

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

/**
 * Genera el Inventario General en Excel.
 * Mismos datos y orden que el PDF (ultimoregistro=1 y estadoinventario no vacío,
 * ordenados por código):
 * [Código Activo, Rubro, Tipo Rubro, Descripción, Ciudad, Inmueble, Nivel, Ambiente, Responsable, Carnet]
 */
export const useReporteInventarioGeneralExcel = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    try {
      toast({ title: "Generando Inventario General (Excel)", description: "Cargando catálogos..." });

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
      const ubicacionPartsMap = {};
      const ciudadPorAmbiente = {};
      (ambientes || []).forEach((a) => {
        const code = String(a.codigoambiente ?? "").trim();
        if (!code) return;
        const nivel = nivelMap[String(a.codigonivel ?? "").trim()];
        const inmuebleCode = String(nivel?.codigoinmueble ?? "").trim();
        const inmueble = nivel ? inmuebleMap[inmuebleCode] : null;
        const ciudad = inmueble ? ciudadMap[String(inmueble.codigociudad ?? "").trim()] : null;
        ubicacionJerarquiaMap[code] =
          [ciudad?.descripcion, inmueble?.inmueble, nivel?.nivel, a.ambiente]
            .map((s) => (s || "").trim())
            .filter(Boolean)
            .join(" / ") || String(code);
        ubicacionPartsMap[code] = {
          ciudad: String(ciudad?.descripcion ?? "").trim() || "—",
          inmueble: String(inmueble?.inmueble ?? "").trim() || "—",
          nivel: String(nivel?.nivel ?? "").trim() || "—",
          ambiente: String(a.ambiente ?? "").trim() || "—",
        };
        let ciudadDesc = String(ciudad?.descripcion ?? "").trim().toUpperCase();
        if (inmuebleCode === "2309" && ciudadDesc === "LA PAZ") ciudadDesc = "ACHOCALLA";
        else if (inmuebleCode === "2327" && ciudadDesc === "LA PAZ") ciudadDesc = "LAJA";
        else if (inmuebleCode === "2341" && ciudadDesc === "LA PAZ") ciudadDesc = "PALOS BLANCOS";
        else if (inmuebleCode === "2371" && ciudadDesc === "LA PAZ") ciudadDesc = "SAN ANDRES DE MACHACA";
        ciudadPorAmbiente[code] = ciudadDesc || "SIN CIUDAD";
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

      toast({ title: "Cargando activos", description: "Obteniendo activos con ultimoregistro=1 (con excepción por ciudades)..." });

      let allActivos = [];
      let from = 0;
      const FETCH_CHUNK = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("act_activos")
          .select(ACTIVO_COLUMNS)
          .eq("ultimoregistro", 1)
          // PK única para paginación estable (ver comentario en versión PDF)
          .order("codigoactivointerno", { ascending: true })
          .range(from, from + FETCH_CHUNK - 1);
        if (error) throw error;
        const batch = toCamelCaseArray(data || []);
        if (batch.length === 0) break;
        allActivos = allActivos.concat(batch);
        if (batch.length < FETCH_CHUNK) break;
        from += FETCH_CHUNK;
        if (allActivos.length > 60000) break;
        await new Promise((r) => setTimeout(r, 0));
      }

      // Regla: estadoinventario no vacío, EXCEPTO ciudades excepción que traen todo con ultimoregistro=1
      allActivos = allActivos.filter((a) => {
        const ambCode = String(a.codigoAmbiente ?? "").trim();
        const ciudad = String(ciudadPorAmbiente[ambCode] ?? "").trim().toUpperCase();
        if (CIUDADES_EXCEPCION_SET.has(ciudad)) return true;
        const estadoInv = String(a.estadoinventario ?? a.estadoInventario ?? "").trim();
        return estadoInv !== "";
      });

      // Excluir rubros BIBLIOTECAS, EDIFICACIONES y TERRENOS del Inventario General
      const normRubroExc = (s) => String(s || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const RUBROS_EXCLUIDOS = ["BIBLIOTEC", "EDIFICAC", "TERRENO"];
      allActivos = allActivos.filter((a) => {
        const rubroDesc = rubroFromTipo[a.tipoRubroAct] ?? rubroFromTipo[String(a.tipoRubroAct)] ?? "";
        return !RUBROS_EXCLUIDOS.some((k) => normRubroExc(rubroDesc).includes(k));
      });

      if (allActivos.length === 0) {
        toast({ title: "Sin datos", description: "No hay activos con ultimoregistro=1 y estadoinventario no vacío.", variant: "destructive" });
        return;
      }

      allActivos.sort((a, b) => {
        const codA = String(a.codigoActivo ?? "").trim();
        const codB = String(b.codigoActivo ?? "").trim();
        const numA = Number(codA.replace(/\D/g, ""));
        const numB = Number(codB.replace(/\D/g, ""));
        if (numA && numB && numA !== numB) return numA - numB;
        return codA.localeCompare(codB, "es", { numeric: true });
      });

      const dataRows = allActivos.map((a) => {
        const tipoDesc = tipoRubroDescMap[a.tipoRubroAct] ?? tipoRubroDescMap[String(a.tipoRubroAct)] ?? "—";
        const rubroDesc = rubroFromTipo[a.tipoRubroAct] ?? rubroFromTipo[String(a.tipoRubroAct)] ?? "—";
        const ambCode = String(a.codigoAmbiente ?? "").trim();
        const parts = ubicacionPartsMap[ambCode];
        const ciudad = parts?.ciudad || "—";
        const inmueble = parts?.inmueble || "—";
        const nivel = parts?.nivel || "—";
        const ambiente = parts?.ambiente || ambCode || "—";
        const responsableName = resolveResponsableName(a.cirun);
        const ci = String(a.cirun ?? "").trim() || "—";
        const codigoFormateado = a.codigoActivo != null ? `OJ-02-${a.codigoActivo}` : "—";
        const descripcion = String(a.descripcionActivo ?? a.descripcionactivo ?? "—").replace(/\s+/g, " ").trim() || "—";
        return [codigoFormateado, rubroDesc, tipoDesc, descripcion, ciudad, inmueble, nivel, ambiente, responsableName, ci];
      });

      toast({ title: "Generando Excel", description: `Construyendo reporte con ${dataRows.length} activos...` });

      const headers = ["Código Activo", "Rubro", "Tipo Rubro", "Descripción del Activo", "Ciudad", "Inmueble", "Nivel", "Ambiente", "Responsable", "Carnet"];
      const sheetData = [
        ["INVENTARIO GENERAL - ÓRGANO JUDICIAL"],
        [`Total activos: ${dataRows.length} (ultimoregistro=1, estadoinventario no vacío, ordenados por código)`],
        [],
        headers,
        ...dataRows,
      ];

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws["!cols"] = [{ wch: 16 }, { wch: 28 }, { wch: 28 }, { wch: 50 }, { wch: 22 }, { wch: 28 }, { wch: 18 }, { wch: 28 }, { wch: 30 }, { wch: 16 }];
      // Congelar encabezado (fila 4) para facilitar lectura
      ws["!freeze"] = "A4";
      ws["!autofilter"] = { ref: `A4:J${sheetData.length}` };
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Inventario General");
      XLSX.writeFile(wb, `Inventario_General_ultimoregistro1.xlsx`);

      toast({ title: "Reporte generado", description: `Se exportaron ${dataRows.length} activos ordenados por código.` });
    } catch (err) {
      console.error("Error generando Inventario General (Excel)", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
