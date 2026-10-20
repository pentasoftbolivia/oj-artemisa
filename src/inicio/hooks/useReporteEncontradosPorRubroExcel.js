import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { getCachedCatalog } from "@/lib/catalogCache";
import { toCamelCaseArray } from "@/lib/mapFields";
import { useToast } from "@/hooks/use-toast";
import { ACTIVO_COLUMNS } from "@/lib/activoColumns";

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

const HEADERS = ["N°", "Rubro", "Total Activos"];

const TODO_REVALUO_HEADERS = [...HEADERS, "Valor Revalúo"];

/**
 * Reporte ENCONTRADOS POR RUBRO en Excel.
 * Mismo criterio que ENCONTRADOS EN ESTADO BAJA:
 * codigoactivo <= 43753 AND estadoinventario IS NOT NULL AND estadoinventario <> ''
 * AND artemisaaltabaja=0 AND ultimoregistro=1.
 * Con la opción soloActivos agrega AND esactivo=true.
 * Con la opción todoRevaluo agrega la columna Valor Revalúo, sumando
 * act_activos.valorrevaluo por rubro.
 */
export const useReporteEncontradosPorRubroExcel = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async (options = {}) => {
  const soloActivos = options?.soloActivos === true;
  const soloNoActivos = options?.soloNoActivos === true;
  const enAlta = options?.enAlta === true;
  const estabanEnBaja = options?.estabanEnBaja === true;
  const obsoleto = options?.obsoleto === true;
  const todoRevaluo = options?.todoRevaluo === true;
  const revaluo2553 = options?.revaluo2553 === true;
  const revaluo1355 = options?.revaluo1355 === true;
  const encontradosFisicamente = options?.encontradosFisicamente === true;
  const encontradosEnBajaFisicamente = options?.encontradosEnBajaFisicamente === true;
    setIsGenerating(true);
    try {
      toast({ title: "Generando Encontrados por Rubro (Excel)", description: "Cargando catálogos..." });

      const [rubros, tipoRubros] = await Promise.all([
        getCachedCatalog("act_rubro"),
        getCachedCatalog("act_tiporubro"),
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

      toast({ title: "Cargando activos", description: "Obteniendo encontrados en estado baja..." });

      let allActivos = [];
      let from = 0;
      const FETCH_CHUNK = 1000;
      while (true) {
        let query = supabase
          .from("act_activos")
          .select(`${ACTIVO_COLUMNS},artemisaaltabaja,esactivo,activonuevo,valorrevaluo`);
        if (todoRevaluo) {
          // OR exacto de los 3 grupos de revalúo. Sin los filtros base globales:
          // el grupo 3 solo exige activonuevo=true.
          query = query.or([
            "and(codigoactivo.lte.43753,artemisaaltabaja.eq.0,ultimoregistro.eq.1,esactivo.eq.true,estadoconservacion.neq.MALO)",
            "and(codigoactivo.lte.43753,artemisaaltabaja.eq.1,pararevaluo.eq.true,activonuevo.eq.false,estadoconservacion.neq.MALO)",
            "activonuevo.eq.true",
          ].join(","));
        } else {
          query = query
            .lte("codigoactivo", 43753)
            .not("estadoinventario", "is", null)
            .neq("estadoinventario", "")
            .eq("ultimoregistro", 1);
          if (revaluo1355) query = query.eq("artemisaaltabaja", 1).eq("pararevaluo", true).eq("activonuevo", false).neq("estadoconservacion", "MALO");
          else if (revaluo2553) query = query.eq("artemisaaltabaja", 1).eq("pararevaluo", true).eq("activonuevo", false).neq("estadoconservacion", "MALO");
          else if (encontradosFisicamente) query = query.eq("artemisaaltabaja", 1);
          else if (encontradosEnBajaFisicamente) query = query.eq("artemisaaltabaja", 0);
          else if (enAlta) query = query.eq("artemisaaltabaja", 1).eq("esactivo", true);
          else if (obsoleto) query = query.eq("artemisaaltabaja", 1).eq("estadoconservacion", "MALO");
          else if (estabanEnBaja) query = query.eq("artemisaaltabaja", 0).eq("esactivo", true).neq("estadoconservacion", "MALO");
          else if (soloActivos) query = query.eq("artemisaaltabaja", 0).eq("esactivo", true);
          else if (soloNoActivos) query = query.eq("artemisaaltabaja", 0).eq("esactivo", false);
          else query = query.eq("artemisaaltabaja", 0);
        }
        const { data, error } = await query
          .order("codigoactivointerno", { ascending: true })
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
        if (todoRevaluo) {
          const codigoActivo = Number(a.codigoActivo ?? a.codigoactivo ?? 0);
          const estInv = String(a.estadoinventario ?? a.estadoInventario ?? "").trim();
          const tieneEstInv = estInv !== "";
          const esUltimo = String(a.ultimoregistro ?? a.ultimoRegistro ?? "").trim() === "1";
          const artemisa = Number(a.artemisaaltabaja ?? a.artemisaAltaBaja ?? NaN);
          const esActivoRaw = a.esactivo ?? a.esActivo;
          const esActivo = esActivoRaw === true || String(esActivoRaw).trim().toUpperCase() === "TRUE" || Number(esActivoRaw) === 1;
          const pararevaluoRaw = a.pararevaluo ?? a.paraRevaluo;
          const esParaRevaluo = pararevaluoRaw === true || String(pararevaluoRaw).trim().toUpperCase() === "TRUE" || Number(pararevaluoRaw) === 1;
          const activoNuevoRaw = a.activonuevo ?? a.activoNuevo;
          const esActivoNuevo = activoNuevoRaw === true || String(activoNuevoRaw).trim().toUpperCase() === "TRUE" || Number(activoNuevoRaw) === 1;
          const esMalo = String(a.estadoconservacion ?? a.estadoConservacion ?? "").trim().toUpperCase() === "MALO";

          const grupo1 = codigoActivo <= 43753 && tieneEstInv && artemisa === 0 && esUltimo && esActivo && !esMalo;
          const grupo2 = codigoActivo <= 43753 && tieneEstInv && artemisa === 1 && esParaRevaluo && !esActivoNuevo && !esMalo;
          const grupo3 = esActivoNuevo;

          return grupo1 || grupo2 || grupo3;
        }
        const estInv = String(a.estadoinventario ?? a.estadoInventario ?? "").trim();
        if (estInv === "") return false;
        const v = a.artemisaaltabaja ?? a.artemisaAltaBaja;
        const codigoActivo = Number(a.codigoActivo ?? a.codigoactivo ?? 0);
        if (encontradosEnBajaFisicamente) {
          const v = a.artemisaaltabaja ?? a.artemisaAltaBaja;
          const codigoActivo = Number(a.codigoActivo ?? a.codigoactivo ?? 0);
          const estInv = String(a.estadoinventario ?? a.estadoInventario ?? "").trim();
          if (estInv === "") return false;
          if (Number(v) !== 0) return false;
          if (codigoActivo > 43753) return false;
          if (a.ultimoregistro != 1) return false;
        } else if (encontradosFisicamente) {
          const v = a.artemisaaltabaja ?? a.artemisaAltaBaja;
          const codigoActivo = Number(a.codigoActivo ?? a.codigoactivo ?? 0);
          const estInv = String(a.estadoinventario ?? a.estadoInventario ?? "").trim();
          if (estInv === "") return false;
          if (Number(v) !== 1) return false;
          if (codigoActivo > 43753) return false;
          if (a.ultimoregistro != 1) return false;
        } else         if (revaluo1355) {
          const pv = a.pararevaluo ?? a.paraRevaluo;
          const esPV = pv === true || String(pv).trim().toUpperCase() === "TRUE" || Number(pv) === 1;
          const an = a.activonuevo ?? a.activoNuevo;
          const esAN = an === true || String(an).trim().toUpperCase() === "TRUE" || Number(an) === 1;
          const v = a.artemisaaltabaja ?? a.artemisaAltaBaja;
          const ec = String(a.estadoconservacion ?? a.estadoConservacion ?? "").trim().toUpperCase();
          if (!esPV || esAN) return false;
          if (Number(v) !== 1) return false;
          if (ec === "MALO") return false;
        } else if (revaluo2553) {
          const pv = a.pararevaluo ?? a.paraRevaluo;
          const esPV = pv === true || String(pv).trim().toUpperCase() === "TRUE" || Number(pv) === 1;
          const an = a.activonuevo ?? a.activoNuevo;
          const esAN = an === true || String(an).trim().toUpperCase() === "TRUE" || Number(an) === 1;
          const v = a.artemisaaltabaja ?? a.artemisaAltaBaja;
          const ec = String(a.estadoconservacion ?? a.estadoConservacion ?? "").trim().toUpperCase();
          if (!esPV || esAN) return false;
          if (Number(v) !== 1) return false;
          if (ec === "MALO") return false;
        } else if (obsoleto) {
          if (!(Number(v) === 1)) return false;
          const ec = String(a.estadoconservacion ?? a.estadoConservacion ?? "").trim().toUpperCase();
          if (ec !== "MALO") return false;
        } else if (estabanEnBaja) {
          if (!(Number(v) === 0)) return false;
          const esActivo = a.esactivo ?? a.esActivo;
          if (esActivo == null) return false;
          if (!(esActivo === true || String(esActivo).toLowerCase() === "true" || Number(esActivo) === 1)) return false;
          const ec = String(a.estadoconservacion ?? a.estadoConservacion ?? "").trim().toUpperCase();
          if (ec === "MALO") return false;
        } else if (enAlta) {
          if (!(Number(v) === 1)) return false;
          const esActivo = a.esactivo ?? a.esActivo;
          if (esActivo == null) return false;
          if (!(esActivo === true || String(esActivo).toLowerCase() === "true" || Number(esActivo) === 1)) return false;
        } else if (soloActivos) {
          if (!(Number(v) === 0)) return false;
          const esActivo = a.esactivo ?? a.esActivo;
          if (esActivo == null) return false;
          if (!(esActivo === true || String(esActivo).toLowerCase() === "true" || Number(esActivo) === 1)) return false;
        } else if (soloNoActivos) {
          if (!(Number(v) === 0)) return false;
          const esActivo = a.esactivo ?? a.esActivo;
          if (esActivo == null) return false;
          if (!(esActivo === false || String(esActivo).toLowerCase() === "false" || Number(esActivo) === 0)) return false;
        } else {
          if (!(Number(v) === 0)) return false;
        }
        return codigoActivo <= 43753 && a.ultimoregistro == 1;
      });

      if (allActivos.length === 0) {
        toast({ title: "Sin datos", description: "No hay activos encontrados en estado baja.", variant: "destructive" });
        return;
      }

      const conteoPorRubro = new Map();
      const valorRevaluoPorRubro = new Map();
      allActivos.forEach((a) => {
        const tipo = a.tipoRubroAct ?? a.tiporubroact;
        const rubroDesc = String(rubroFromTipo[tipo] ?? rubroFromTipo[String(tipo)] ?? "SIN RUBRO").trim() || "SIN RUBRO";
        conteoPorRubro.set(rubroDesc, (conteoPorRubro.get(rubroDesc) ?? 0) + 1);
        valorRevaluoPorRubro.set(
          rubroDesc,
          (valorRevaluoPorRubro.get(rubroDesc) ?? 0) + (Number(a.valorRevaluo ?? a.valorrevaluo) || 0)
        );
      });
      const rubrosOrdenados = [...conteoPorRubro.keys()].sort((x, y) => x.localeCompare(y, "es"));
      const totalRevaluo = allActivos.reduce((s, a) => s + (Number(a.valorRevaluo ?? a.valorrevaluo) || 0), 0);

      toast({ title: "Generando Excel", description: `Construyendo reporte con ${rubrosOrdenados.length} rubros...` });

      const dateStr = new Date().toISOString().slice(0, 10);
      const rows = rubrosOrdenados.map((rubro, idx) => [
        idx + 1,
        rubro,
        conteoPorRubro.get(rubro),
        ...(todoRevaluo ? [valorRevaluoPorRubro.get(rubro) ?? 0] : []),
      ]);

      const sheetData = [
        [encontradosEnBajaFisicamente ? "ENCONTRADOS EN BAJA FISICAMENTE POR RUBRO - ÓRGANO JUDICIAL" : encontradosFisicamente ? "ENCONTRADOS FISICAMENTE POR RUBRO - ÓRGANO JUDICIAL" : revaluo1355 ? "REVALUO 1355 POR RUBRO - ÓRGANO JUDICIAL" : revaluo2553 ? "REVALUO 2553 POR RUBRO - ÓRGANO JUDICIAL" : todoRevaluo ? "TODO REVALUO POR RUBRO - ÓRGANO JUDICIAL" : obsoleto ? "OBSOLETO POR RUBRO - ÓRGANO JUDICIAL" : estabanEnBaja ? "ACTIVOS QUE ESTABAN EN BAJA POR RUBRO - ÓRGANO JUDICIAL" : enAlta ? "ENCONTRADO BAJA SI SON ACTIVOS POR RUBRO - ÓRGANO JUDICIAL" : soloActivos ? "ENCONTRADO BAJA SI SON ACTIVOS POR RUBRO - ÓRGANO JUDICIAL" : soloNoActivos ? "ENCONTRADOS BAJA NO SON ACTIVOS POR RUBRO - ÓRGANO JUDICIAL" : "ENCONTRADOS POR RUBRO - ÓRGANO JUDICIAL"],
        [`Total activos: ${allActivos.length} en ${rubrosOrdenados.length} rubros`],
        [`Fecha: ${dateStr}`],
        [],
        todoRevaluo ? TODO_REVALUO_HEADERS : HEADERS,
        ...rows,
        [
          "", "TOTAL GENERAL", allActivos.length,
          ...(todoRevaluo ? [totalRevaluo] : []),
        ],
      ];

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws["!cols"] = todoRevaluo
        ? [{ wch: 6 }, { wch: 55 }, { wch: 16 }, { wch: 20 }]
        : [{ wch: 6 }, { wch: 60 }, { wch: 16 }];
      if (todoRevaluo) {
        const moneyFormat = "0.0000";
        for (let i = 0; i <= rubrosOrdenados.length; i++) {
          const cell = ws[XLSX.utils.encode_cell({ r: 5 + i, c: 3 })];
          if (cell && cell.t === "n") cell.z = moneyFormat;
        }
      }
      ws["!pageSetup"] = { orientation: "portrait", paperSize: 1, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
      ws["!margins"] = { left: 0.5, right: 0.5, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, soloActivos ? "Encontrado Activos Rubro" : soloNoActivos ? "Encontrados No Activos Rubro" : "Por Rubro");
      XLSX.writeFile(wb, encontradosEnBajaFisicamente ? `Encontrados_En_Baja_Fisicamente_Por_Rubro_${dateStr}.xlsx` : encontradosFisicamente ? `Encontrados_Fisicamente_Por_Rubro_${dateStr}.xlsx` : revaluo1355 ? `Revaluo_1355_Por_Rubro_${dateStr}.xlsx` : revaluo2553 ? `Revaluo_2553_Por_Rubro_${dateStr}.xlsx` : todoRevaluo ? `Todo_Revaluo_Por_Rubro_${dateStr}.xlsx` : obsoleto ? `Obsoleto_Por_Rubro_${dateStr}.xlsx` : estabanEnBaja ? `Activos_Que_Estaban_En_Baja_Por_Rubro_${dateStr}.xlsx` : enAlta ? `Encontrado_Baja_Si_Son_Activos_Por_Rubro_${dateStr}.xlsx` : soloActivos ? `Encontrado_Baja_Si_Son_Activos_Por_Rubro_${dateStr}.xlsx` : soloNoActivos ? `Encontrados_Baja_No_Son_Activos_Por_Rubro_${dateStr}.xlsx` : `Encontrados_Por_Rubro_${dateStr}.xlsx`);

      toast({ title: "Reporte generado", description: `Se exportaron ${allActivos.length} activos en ${rubrosOrdenados.length} rubros.` });
    } catch (err) {
      console.error("Error generando Encontrados por Rubro (Excel)", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
