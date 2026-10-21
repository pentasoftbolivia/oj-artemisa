import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { getCachedCatalog } from "@/lib/catalogCache";
import { toCamelCaseArray } from "@/lib/mapFields";
import { useToast } from "@/hooks/use-toast";
import { ACTIVO_COLUMNS } from "@/lib/activoColumns";
import { normalizeCi, normalizeCiLoose, getCiPrefix } from "../constants/inventarioConstants";
import { buildParamTasaMap, resolveTasaFromParams } from "../constants/depreciacionConstants";
import { grabarValorNetoConProgreso } from "../services/grabarValorNeto";

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

const parseNumDep = (v) => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(String(v).replace(",", "."));
  return isNaN(n) ? null : n;
};

const esMaquinariaProduccion = (rubroDesc) => {
  const n = String(rubroDesc ?? "").toUpperCase();
  return n.includes("MAQUINARIA") && n.includes("PRODUCCION");
};

const HEADERS = [
  "N°", "Código Activo", "Rubro", "Tipo Rubro", "Descripción",
  "Ubicación", "Responsable", "Carnet",
  "Costo Inicial al 31/12/2025", "Depreciacion Acumulada al 31/12/2025", "Costo Actualizado",
  "Depreciacion Actualizada", "Depreciacion Acumulado Total", "%Dep. Mes",
  "Depreciacion del Periodo", "Costo Total Actualizado al 09/10/2026", "Revaluo",
  "Depreciacion Total", "Valor Neto",
];

/**
 * Reporte DEPRECIACION en Excel — PRODUCTO 3.
 * Criterio: codigoactivo <= 43753 AND estadoinventario IS NOT NULL AND estadoinventario <> ''
 * AND artemisaaltabaja IN (0,1) AND ultimoregistro = 1.
 * Columnas tras Carnet: Costo Inicial al 31/12/2025 (saldoinicial_exp),
 * Depreciacion Acumulada al 31/12/2025 (depacum_exp), Costo Actualizado (pordepanu),
 * Depreciacion Actualizada (actdepacum_exp), Depreciacion Acumulado Total (depacumtotal_exp),
 * %Dep. Mes (tasa_anual/12 de act_param_depreciacion por rubro, 8 decimales),
 * Depreciacion del Periodo ((%Dep.Mes_8dec * 10) * Costo Total Actualizado),
 * Costo Total Actualizado al 09/10/2026 (costactuali_exp),
 * Revaluo (valorrevaluo por activo),
 * Depreciacion Total (depacumtotal_exp + Dep. Periodo),
 * Valor Neto ((Costo Total Actualizado al 09/10/2026 + Revaluo) - Dep. Total).
 * Al generar el reporte completo también guarda el Valor Neto calculado en
 * act_activos.valorneto (en segundo plano, solo filas cuyo valor cambió).
 * Orden: codigoactivo ASC.
 */
export const useReporteDepreciacionExcel = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async (options = {}) => {
    const soloMaquinaria = !!options?.soloMaquinaria;
    setIsGenerating(true);
    try {
      toast({ title: soloMaquinaria ? "Generando Maquinaria y Equipos de Producción (Excel)" : "Generando Depreciación (Excel)", description: "Cargando catálogos..." });

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

      toast({ title: "Cargando activos", description: "Obteniendo activos con codigoactivo <= 43753, estadoinventario con dato, artemisaaltabaja in (0,1) y ultimoregistro=1..." });

      const fetchActivos = async () => {
        let rows = [];
        let from = 0;
        const FETCH_CHUNK = 1000;
        while (true) {
          const { data, error } = await supabase
            .from("act_activos")
            .select(`${ACTIVO_COLUMNS},artemisaaltabaja,esactivo,saldoinicial_exp,depacum_exp,pordepanu,actdepacum_exp,depacumtotal_exp,costactuali_exp,valorrevaluo,valorneto`)
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
          rows = rows.concat(batch);
          if (batch.length < FETCH_CHUNK) break;
          from += FETCH_CHUNK;
          if (rows.length > 100000) break;
          await new Promise((r) => setTimeout(r, 0));
        }
        return rows;
      };

      let allActivos = await fetchActivos();
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
      allActivos.sort((a, b) => Number(a.codigoActivo ?? a.codigoactivo ?? 0) - Number(b.codigoActivo ?? b.codigoactivo ?? 0));

      if (soloMaquinaria) {
        allActivos = allActivos.filter((a) => {
          const tipoRubroAct = a.tipoRubroAct ?? a.tiporubroact;
          const rubroDesc = rubroFromTipo[tipoRubroAct] ?? rubroFromTipo[String(tipoRubroAct)] ?? "";
          return esMaquinariaProduccion(rubroDesc);
        });
      }

      if (allActivos.length === 0) {
        toast({
          title: "Sin datos",
          description: soloMaquinaria
            ? "No hay activos de MAQUINARIA Y EQUIPOS DE PRODUCCION con el criterio aplicado."
            : "No hay activos con codigoactivo <= 43753, estadoinventario con dato, artemisaaltabaja in (0,1) y ultimoregistro=1.",
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Generando Excel", description: `Construyendo reporte con ${allActivos.length} activos...` });

      const dateStr = new Date().toISOString().slice(0, 10);
      let totalValorNeto = 0;
      const valorNetoItems = [];
      const rows = allActivos.map((a, idx) => {
        const codigoActivo = a.codigoActivo ?? a.codigoactivo;
        const tipoRubroAct = a.tipoRubroAct ?? a.tiporubroact;
        const rubroDesc = rubroFromTipo[tipoRubroAct] ?? rubroFromTipo[String(tipoRubroAct)] ?? "";
        const ambCode = String(a.codigoAmbiente ?? a.codigoambiente ?? "").trim();
        const ciRaw = String(a.cirun ?? "").trim();
        const tasaAnual = resolveTasaFromParams(rubroDesc, paramTasaMap);
        const depMesRaw = tasaAnual !== null && tasaAnual !== undefined ? tasaAnual / 12 : null;
        const depMes = depMesRaw !== null && depMesRaw !== undefined ? Number(depMesRaw.toFixed(8)) : null;
        const costoTotal0910 = parseNumDep(a.costActualiExp ?? a.costactuali_exp);
        const depAcumTotDb = parseNumDep(a.depAcumTotalExp ?? a.depacumtotal_exp);
        const depPeriodo = depMes !== null && costoTotal0910 !== null ? (depMes * 10) * costoTotal0910 : null;
        const depTotal = depAcumTotDb !== null && depPeriodo !== null ? depAcumTotDb + depPeriodo : null;
        const revaluo = parseNumDep(a.valorRevaluo ?? a.valorrevaluo);
        const costoTotalRevaluado = costoTotal0910 !== null && revaluo !== null ? costoTotal0910 + revaluo : null;
        const valorNeto = costoTotalRevaluado !== null && depTotal !== null ? costoTotalRevaluado - depTotal : null;
        totalValorNeto += valorNeto ?? 0;
        valorNetoItems.push({
          interno: a.codigoActivoInterno ?? a.codigoactivointerno,
          valorNeto,
          actual: parseNumDep(a.valorNeto ?? a.valorneto),
        });
        return [
          idx + 1,
          codigoActivo != null ? `OJ-02-${codigoActivo}` : "—",
          clean(rubroDesc),
          clean(tipoRubroDescMap[tipoRubroAct] ?? tipoRubroDescMap[String(tipoRubroAct)]),
          clean(a.descripcionActivo ?? a.descripcionactivo),
          clean(ubicacionMap[ambCode] || ambCode),
          clean(responsableNameOf(ciRaw)),
          ciRaw || "—",
          parseNumDep(a.saldoInicialExp ?? a.saldoinicial_exp) ?? "",
          parseNumDep(a.depAcumExp ?? a.depacum_exp) ?? "",
          parseNumDep(a.porDepAnu ?? a.pordepanu) ?? "",
          parseNumDep(a.actDepAcumExp ?? a.actdepacum_exp) ?? "",
          depAcumTotDb ?? "",
          depMes ?? "",
          depPeriodo ?? "",
          costoTotal0910 ?? "",
          revaluo ?? "",
          depTotal ?? "",
          valorNeto ?? "",
        ];
      });

      const sheetData = [
        [soloMaquinaria ? "ACTIVOS DE MAQUINARIA Y EQUIPOS DE PRODUCCION - ÓRGANO JUDICIAL" : "DEPRECIACION - ÓRGANO JUDICIAL"],
        [`Total activos: ${allActivos.length}`],
        [`Fecha: ${dateStr}`],
        [],
        HEADERS,
        ...rows,
        ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "TOTAL", totalValorNeto],
      ];

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      // Descripción (col E, índice 4) más ancha; resto compacto para que quepa en horizontal.
      ws["!cols"] = [{ wch: 6 }, { wch: 15 }, { wch: 24 }, { wch: 26 }, { wch: 90 }, { wch: 45 }, { wch: 28 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 18 }];
      // Hoja en forma horizontal al imprimir + ajustar a 1 página de ancho.
      ws["!pageSetup"] = { orientation: "landscape", paperSize: 1, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
      ws["!margins"] = { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
      ws["!printOptions"] = { horizontalCentered: true };
      ws["!sheetProps"] = { pageSetUpPr: { fitToPage: true } };
      const moneyFmt = "#,##0.0000";
      const mesFmt = "0.00000000";
      const perFmt = "0.0000";
      for (let r = 0; r < rows.length; r++) {
        const rowNumber = 6 + r;
        for (let c = 8; c <= 12; c++) {
          const cell = ws[XLSX.utils.encode_cell({ r: rowNumber - 1, c })];
          if (cell && typeof cell.v === "number") cell.z = moneyFmt;
        }
        const mesCell = ws[XLSX.utils.encode_cell({ r: rowNumber - 1, c: 13 })];
        if (mesCell && typeof mesCell.v === "number") mesCell.z = mesFmt;
        const perCell = ws[XLSX.utils.encode_cell({ r: rowNumber - 1, c: 14 })];
        if (perCell && typeof perCell.v === "number") perCell.z = perFmt;
        for (let c = 15; c <= 18; c++) {
          const sumCell = ws[XLSX.utils.encode_cell({ r: rowNumber - 1, c })];
          if (sumCell && typeof sumCell.v === "number") sumCell.z = moneyFmt;
        }
      }
      const totalNetoCell = ws[XLSX.utils.encode_cell({ r: 5 + rows.length, c: 18 })];
      if (totalNetoCell && typeof totalNetoCell.v === "number") totalNetoCell.z = moneyFmt;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, soloMaquinaria ? "Maquinaria" : "Depreciacion");
      XLSX.writeFile(
        wb,
        soloMaquinaria
          ? `Activos_de_MAQUINARIA_Y_EQUIPOS_DE_PRODUCCION_${dateStr}.xlsx`
          : `Depreciacion_${dateStr}.xlsx`
      );

      toast({ title: "Reporte generado", description: `Se exportaron ${allActivos.length} activos.` });

      if (!soloMaquinaria) {
        void grabarValorNetoConProgreso(supabase, valorNetoItems, toast);
      }
    } catch (err) {
      console.error("Error generando Depreciación (Excel)", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
