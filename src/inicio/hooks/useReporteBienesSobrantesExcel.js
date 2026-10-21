import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { getCachedCatalog } from "@/lib/catalogCache";
import { toCamelCaseArray } from "@/lib/mapFields";
import { useToast } from "@/hooks/use-toast";
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

const parseNumBE = (v) => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(String(v).replace(",", "."));
  return isNaN(n) ? null : n;
};

const HEADERS = [
  "N°", "Código Activo", "Rubro", "Tipo Rubro", "Descripción",
  "Ubicación", "Responsable", "Carnet", "Valor Revaluado",
];

const isTrueish = (v) => {
  if (v === true || v === 1) return true;
  const s = String(v ?? "").trim().toUpperCase();
  return s === "TRUE" || s === "1" || s === "T" || s === "SI" || s === "SÍ";
};

/**
 * Reporte BIENES SOBRANTES en Excel — PRODUCTO 3.
 * Criterio: ultimoregistro=1 AND activonuevo=TRUE.
 * Columnas tras Carnet: Valor Revaluado (valorrevaluo). No hay más columnas.
 * Orden: codigoactivo ASC.
 */
export const useReporteBienesSobrantesExcel = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async (options = {}) => {
    const porRubro = options?.porRubro === true;
    setIsGenerating(true);
    try {
      toast({ title: "Generando Bienes Sobrantes (Excel)", description: "Cargando catálogos..." });

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

      toast({ title: "Cargando activos", description: "Obteniendo bienes sobrantes (activonuevo=TRUE)..." });

      let allActivos = [];
      {
        let from = 0;
        const FETCH_CHUNK = 1000;
        while (true) {
          // Igual al script verificado: select * where activonuevo=true and ultimoregistro=1
          const { data, error } = await supabase
            .from("act_activos")
            .select("*")
            .eq("activonuevo", true)
            .eq("ultimoregistro", 1)
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
      allActivos = allActivos.filter((a) => isTrueish(a.activonuevo ?? a.activoNuevo));
      allActivos.sort((a, b) => Number(a.codigoActivo ?? a.codigoactivo ?? 0) - Number(b.codigoActivo ?? b.codigoactivo ?? 0));
      const totalRevaluo = allActivos.reduce(
        (s, a) => s + (parseNumBE(a.valorRevaluo ?? a.valorrevaluo) ?? 0),
        0
      );

      if (porRubro) {
        const conteoPorRubro = new Map();
        const valorPorRubro = new Map();
        allActivos.forEach((a) => {
          const tipo = a.tipoRubroAct ?? a.tiporubroact;
          const rubroDesc = String(rubroFromTipo[tipo] ?? rubroFromTipo[String(tipo)] ?? "SIN RUBRO").trim() || "SIN RUBRO";
          conteoPorRubro.set(rubroDesc, (conteoPorRubro.get(rubroDesc) ?? 0) + 1);
          const revaluo = parseNumBE(a.valorRevaluo ?? a.valorrevaluo) ?? 0;
          valorPorRubro.set(rubroDesc, (valorPorRubro.get(rubroDesc) ?? 0) + revaluo);
        });
        const rubrosOrdenados = [...conteoPorRubro.keys()].sort((x, y) => x.localeCompare(y, "es"));
        const dateStr = new Date().toISOString().slice(0, 10);
        const rows = rubrosOrdenados.map((rubro, idx) => [
          idx + 1,
          rubro,
          conteoPorRubro.get(rubro),
          valorPorRubro.get(rubro) ?? 0,
        ]);
        const sheetData = [
          ["BIENES SOBRANTES POR RUBRO - ÓRGANO JUDICIAL"],
          [`Total activos: ${allActivos.length} en ${rubrosOrdenados.length} rubros`],
          [`Fecha: ${dateStr}`],
          [],
          ["N°", "Rubro", "Total Activos", "Valor Revaluado"],
          ...rows,
          ["", "TOTAL GENERAL", allActivos.length, totalRevaluo],
        ];
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws["!cols"] = [{ wch: 6 }, { wch: 50 }, { wch: 16 }, { wch: 18 }];
        for (let r = 0; r <= rows.length; r++) {
          const cell = ws[XLSX.utils.encode_cell({ r: 5 + r, c: 3 })];
          if (cell && typeof cell.v === "number") cell.z = "#,##0.00";
        }
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sobrantes Rubro");
        XLSX.writeFile(wb, `Bienes_Sobrantes_Por_Rubro_${dateStr}.xlsx`);
        toast({ title: "Reporte generado", description: `Se exportaron ${allActivos.length} activos en ${rubrosOrdenados.length} rubros.` });
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
        const revaluo = parseNumBE(a.valorRevaluo ?? a.valorrevaluo);
        return [
          idx + 1,
          codigoActivo != null ? `OJ-02-${codigoActivo}` : "—",
          clean(rubroDesc),
          clean(tipoRubroDescMap[tipoRubroAct] ?? tipoRubroDescMap[String(tipoRubroAct)]),
          clean(a.descripcionActivo ?? a.descripcionactivo),
          clean(ubicacionMap[ambCode] || ambCode),
          clean(responsableNameOf(ciRaw)),
          ciRaw || "—",
          revaluo ?? "",
        ];
      });

      const sheetData = [
        ["BIENES SOBRANTES - ÓRGANO JUDICIAL"],
        [`Total bienes sobrantes: ${allActivos.length}`],
        [`Fecha: ${dateStr}`],
        [],
        HEADERS,
        ...rows,
        ["", "", "", "", "", "", "", "TOTAL", totalRevaluo],
      ];

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws["!cols"] = [{ wch: 6 }, { wch: 16 }, { wch: 28 }, { wch: 30 }, { wch: 70 }, { wch: 50 }, { wch: 32 }, { wch: 16 }, { wch: 18 }];
      ws["!pageSetup"] = { orientation: "landscape", paperSize: 1, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
      ws["!margins"] = { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
      for (let r = 0; r <= rows.length; r++) {
        const cell = ws[XLSX.utils.encode_cell({ r: 5 + r, c: 8 })];
        if (cell && typeof cell.v === "number") cell.z = "#,##0.00";
      }
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sobrantes");
      XLSX.writeFile(wb, `Bienes_Sobrantes_${dateStr}.xlsx`);

      toast({ title: "Reporte generado", description: `Se exportaron ${allActivos.length} bienes sobrantes.` });
    } catch (err) {
      console.error("Error generando Bienes Sobrantes (Excel)", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
