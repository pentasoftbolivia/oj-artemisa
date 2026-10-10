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
  "N°", "Código Activo", "Rubro", "Tipo Rubro", "Descripción",
  "Ubicación", "Responsable", "Carnet",
];

/**
 * Reporte BIENES FALTANTES en Excel — PRODUCTO 3.
 * Criterio: ultimoregistro=1 AND estadoinventario vacío o nulo.
 * Orden: codigoactivo ASC.
 */
export const useReporteBienesFaltantesExcel = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    try {
      toast({ title: "Generando Bienes Faltantes (Excel)", description: "Cargando catálogos..." });

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

      toast({ title: "Cargando activos", description: "Obteniendo bienes faltantes (sin estadoinventario)..." });

      let allActivos = [];
      {
        let from = 0;
        const FETCH_CHUNK = 1000;
        while (true) {
          const { data, error } = await supabase
            .from("act_activos")
            .select(ACTIVO_COLUMNS)
            .eq("ultimoregistro", 1)
            .or("estadoinventario.is.null,estadoinventario.eq.")
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
      }
      allActivos = allActivos.filter((a) => {
        const est = String(a.estadoinventario ?? a.estadoInventario ?? "").trim();
        return est === "";
      });
      allActivos.sort((a, b) => Number(a.codigoActivo ?? a.codigoactivo ?? 0) - Number(b.codigoActivo ?? b.codigoactivo ?? 0));

      if (allActivos.length === 0) {
        toast({ title: "Sin datos", description: "No hay bienes faltantes con ese criterio.", variant: "destructive" });
        return;
      }

      toast({ title: "Generando Excel", description: `Construyendo reporte con ${allActivos.length} activos...` });

      const dateStr = new Date().toISOString().slice(0, 10);
      const rows = allActivos.map((a, idx) => {
        const codigoActivo = a.codigoActivo ?? a.codigoactivo;
        const tipoRubroAct = a.tipoRubroAct ?? a.tiporubroact;
        const ambCode = String(a.codigoAmbiente ?? a.codigoambiente ?? "").trim();
        const ciRaw = String(a.cirun ?? "").trim();
        return [
          idx + 1,
          codigoActivo != null ? `OJ-02-${codigoActivo}` : "—",
          clean(rubroFromTipo[tipoRubroAct] ?? rubroFromTipo[String(tipoRubroAct)]),
          clean(tipoRubroDescMap[tipoRubroAct] ?? tipoRubroDescMap[String(tipoRubroAct)]),
          clean(a.descripcionActivo ?? a.descripcionactivo),
          clean(ubicacionMap[ambCode] || ambCode),
          clean(responsableNameOf(ciRaw)),
          ciRaw || "—",
        ];
      });

      const sheetData = [
        ["BIENES FALTANTES - ÓRGANO JUDICIAL"],
        [`Total bienes faltantes: ${allActivos.length} (ultimoregistro=1, sin estadoinventario)`],
        [`Fecha: ${dateStr}`],
        [],
        HEADERS,
        ...rows,
        ["", "", "", "", "", "", "TOTAL", allActivos.length],
      ];

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws["!cols"] = [{ wch: 6 }, { wch: 16 }, { wch: 32 }, { wch: 34 }, { wch: 50 }, { wch: 55 }, { wch: 35 }, { wch: 16 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Faltantes");
      XLSX.writeFile(wb, `Bienes_Faltantes_${dateStr}.xlsx`);

      toast({ title: "Reporte generado", description: `Se exportaron ${allActivos.length} bienes faltantes.` });
    } catch (err) {
      console.error("Error generando Bienes Faltantes (Excel)", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
