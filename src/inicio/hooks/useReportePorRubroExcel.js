import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { getCachedCatalog } from "@/lib/catalogCache";
import { toCamelCaseArray } from "@/lib/mapFields";
import { useToast } from "@/hooks/use-toast";
import { ACTIVO_COLUMNS } from "@/lib/activoColumns";
import { CIUDADES_EXCEPCION_SET } from "../constants/inventarioConstants";

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
 * Reporte por Rubro en Excel: nombre del rubro + total de activos por rubro,
 * con la misma lógica del Inventario General:
 * - ultimoregistro=1
 * - estadoinventario no vacío, excepto ciudades excepción (traen todo con ultimoregistro=1)
 * - excluye rubros BIBLIOTECAS, EDIFICACIONES y TERRENOS
 */
export const useReportePorRubroExcel = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    try {
      toast({ title: "Generando Reporte por Rubro (Excel)", description: "Cargando catálogos..." });

      const [rubros, tipoRubros, ambientes, ciudades, inmuebles, niveles] = await Promise.all([
        getCachedCatalog("act_rubro"),
        getCachedCatalog("act_tiporubro"),
        getCachedCatalog("act_ambiente"),
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
      (tipoRubros || []).forEach((t) => {
        rubroFromTipo[t.tiporubroact] = rubroDescMap[t.codigorubroact];
        rubroFromTipo[String(t.tiporubroact)] = rubroDescMap[t.codigorubroact];
      });

      const nivelMap = {};
      (niveles || []).forEach((n) => { nivelMap[String(n.codigonivel ?? "").trim()] = n; });
      const inmuebleMap = {};
      (inmuebles || []).forEach((i) => { inmuebleMap[String(i.codigoinmueble ?? "").trim()] = i; });
      const ciudadMap = {};
      (ciudades || []).forEach((c) => { ciudadMap[String(c.codigociudad ?? "").trim()] = c; });

      const ciudadPorAmbiente = {};
      (ambientes || []).forEach((a) => {
        const code = String(a.codigoambiente ?? "").trim();
        if (!code) return;
        const nivel = nivelMap[String(a.codigonivel ?? "").trim()];
        const inmuebleCode = String(nivel?.codigoinmueble ?? "").trim();
        const inmueble = nivel ? inmuebleMap[inmuebleCode] : null;
        const ciudad = inmueble ? ciudadMap[String(inmueble.codigociudad ?? "").trim()] : null;
        let ciudadDesc = String(ciudad?.descripcion ?? "").trim().toUpperCase();
        if (inmuebleCode === "2309" && ciudadDesc === "LA PAZ") ciudadDesc = "ACHOCALLA";
        else if (inmuebleCode === "2327" && ciudadDesc === "LA PAZ") ciudadDesc = "LAJA";
        else if (inmuebleCode === "2341" && ciudadDesc === "LA PAZ") ciudadDesc = "PALOS BLANCOS";
        else if (inmuebleCode === "2371" && ciudadDesc === "LA PAZ") ciudadDesc = "SAN ANDRES DE MACHACA";
        ciudadPorAmbiente[code] = ciudadDesc || "SIN CIUDAD";
      });

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

      allActivos = allActivos.filter((a) => {
        const ambCode = String(a.codigoAmbiente ?? "").trim();
        const ciudad = String(ciudadPorAmbiente[ambCode] ?? "").trim().toUpperCase();
        if (CIUDADES_EXCEPCION_SET.has(ciudad)) return true;
        const estadoInv = String(a.estadoinventario ?? a.estadoInventario ?? "").trim();
        return estadoInv !== "";
      });

      const normRubroExc = (s) => String(s || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const RUBROS_EXCLUIDOS = ["BIBLIOTEC", "EDIFICAC", "TERRENO"];
      allActivos = allActivos.filter((a) => {
        const rubroDesc = rubroFromTipo[a.tipoRubroAct] ?? rubroFromTipo[String(a.tipoRubroAct)] ?? "";
        return !RUBROS_EXCLUIDOS.some((k) => normRubroExc(rubroDesc).includes(k));
      });

      if (allActivos.length === 0) {
        toast({ title: "Sin datos", description: "No hay activos con los filtros del Inventario General.", variant: "destructive" });
        return;
      }

      const conteoPorRubro = new Map();
      allActivos.forEach((a) => {
        const rubroDesc = String(rubroFromTipo[a.tipoRubroAct] ?? rubroFromTipo[String(a.tipoRubroAct)] ?? "SIN RUBRO").trim() || "SIN RUBRO";
        conteoPorRubro.set(rubroDesc, (conteoPorRubro.get(rubroDesc) ?? 0) + 1);
      });
      const rubrosOrdenados = [...conteoPorRubro.keys()].sort((x, y) => x.localeCompare(y, "es"));

      toast({ title: "Generando Excel", description: `Construyendo reporte con ${rubrosOrdenados.length} rubros...` });

      const dateStr = new Date().toISOString().slice(0, 10);
      const sheetData = [
        ["REPORTE POR RUBRO - ÓRGANO JUDICIAL"],
        [`Total activos: ${allActivos.length} en ${rubrosOrdenados.length} rubros (misma lógica del Inventario General)`],
        [`Fecha: ${dateStr}`],
        [],
        ["N°", "Rubro", "Total Activos"],
        ...rubrosOrdenados.map((rubro, idx) => [idx + 1, rubro, conteoPorRubro.get(rubro)]),
        ["", "TOTAL GENERAL", allActivos.length],
      ];

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws["!cols"] = [{ wch: 6 }, { wch: 55 }, { wch: 16 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Por Rubro");
      XLSX.writeFile(wb, `Reporte_Por_Rubro_${dateStr}.xlsx`);

      toast({ title: "Reporte generado", description: `Se exportaron ${allActivos.length} activos en ${rubrosOrdenados.length} rubros.` });
    } catch (err) {
      console.error("Error generando Reporte por Rubro (Excel)", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
