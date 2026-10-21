import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { getCachedCatalog } from "@/lib/catalogCache";
import { toCamelCaseArray } from "@/lib/mapFields";
import { useToast } from "@/hooks/use-toast";
import { ACTIVO_COLUMNS } from "@/lib/activoColumns";
import { buildVidaUtilPorRubro, resolveAniosAsignados } from "@/lib/aniosAsignados";
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

const clean = (v) => String(v ?? "").replace(/\s+/g, " ").trim() || "—";

const HEADERS = [
  "N°", "Código Activo", "Rubro", "Tipo Rubro", "Descripción",
  "Ubicación", "Responsable", "Carnet",
];

const TODO_REVALUO_HEADERS = [...HEADERS, "Valor Revalúo", "Años Asignados"];

const OBSOLETO_DEP_HEADERS = [
  "Costo Inicial al 31/12/2025",
  "Depreciacion Acumulada al 31/12/2025",
  "Costo Actualizado",
  "Depreciacion Actualizada",
  "Depreciacion Acumulado Total",
  "%Dep. Mes",
  "Depreciacion del Periodo",
  "Costo Total Actualizado al 09/10/2026",
  "Revaluo",
  "Costo Total Actualizado Revaluado",
  "Depreciacion Total",
  "Valor Neto",
];

const OBSOLETO_HEADERS = [...HEADERS, ...OBSOLETO_DEP_HEADERS];

const parseNum = (v) => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/**
 * Reporte ENCONTRADOS EN ESTADO BAJA en Excel.
 * Criterio exacto: codigoactivo <= 43753
 * AND estadoinventario IS NOT NULL AND estadoinventario <> ''
 * AND artemisaaltabaja=0 AND ultimoregistro=1.
 * Orden: codigoactivo ASC.
 */
export const useReporteEncontradosBajaExcel = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async (options = {}) => {
  const soloActivos = options?.soloActivos === true;
  const soloNoActivos = options?.soloNoActivos === true;
  const enAlta = options?.enAlta === true;
  const estabanEnBaja = options?.estabanEnBaja === true;
  const obsoleto = options?.obsoleto === true;
  const recalcular = options?.recalcular === true;
  const todoRevaluo = options?.todoRevaluo === true;
  const revaluo2553 = options?.revaluo2553 === true;
  const revaluo1355 = options?.revaluo1355 === true;
  const encontradosFisicamente = options?.encontradosFisicamente === true;
  const encontradosEnBajaFisicamente = options?.encontradosEnBajaFisicamente === true;
    setIsGenerating(true);
    try {
      toast({ title: "Generando Encontrados en Estado Baja (Excel)", description: "Cargando catálogos..." });

      const paramDepPromise = obsoleto
        ? supabase
            .from("act_param_depreciacion")
            .select("rubro,tasa_anual")
            .then(({ data, error }) => {
              if (error) throw error;
              return data || [];
            })
        : Promise.resolve([]);

      const [rubros, tipoRubros, ambientes, responsables, ciudades, inmuebles, niveles, paramDep] = await Promise.all([
        getCachedCatalog("act_rubro"),
        getCachedCatalog("act_tiporubro"),
        getCachedCatalog("act_ambiente"),
        getCachedCatalog("act_responsable"),
        getCachedCatalog("act_ciudad"),
        getCachedCatalog("act_inmueble"),
        getCachedCatalog("act_nivel"),
        paramDepPromise,
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
      const vidaUtilPorRubro = buildVidaUtilPorRubro(rubros);

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

      toast({ title: "Cargando activos", description: "Obteniendo encontrados en estado baja..." });

      const fetchRows = async () => {
        let rows = [];
        let from = 0;
        const FETCH_CHUNK = 1000;
        while (true) {
          // SELECT * FROM act_activos WHERE codigoactivo <= 43753
          // AND estadoinventario IS NOT NULL AND estadoinventario <> ''
          // AND artemisaaltabaja=0 AND ultimoregistro=1
          // AND esactivo=true (solo cuando soloActivos)
          // AND esactivo=false (solo cuando soloNoActivos)
          let query = supabase
            .from("act_activos")
            .select(`${ACTIVO_COLUMNS},artemisaaltabaja,esactivo,estadoconservacion,activonuevo,pararevaluo,valorrevaluo${obsoleto ? ",saldoinicial_exp,depacum_exp,pordepanu,actdepacum_exp,depacumtotal_exp,costactuali_exp" : ""}`);
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
            else if (encontradosFisicamente) query = query.in("artemisaaltabaja", [0, 1]).eq("esactivo", true);
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
          rows = rows.concat(batch);
          if (batch.length < FETCH_CHUNK) break;
          from += FETCH_CHUNK;
          if (rows.length > 100000) break;
          await new Promise((r) => setTimeout(r, 0));
        }
        return rows;
      };

      let allActivos = await fetchRows();
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
          const esActivo = a.esactivo ?? a.esActivo;
          if (estInv === "") return false;
          if (!(Number(v) === 0 || Number(v) === 1)) return false;
          if (esActivo == null) return false;
          if (!(esActivo === true || String(esActivo).toLowerCase() === "true" || Number(esActivo) === 1)) return false;
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
      allActivos.sort((a, b) => Number(a.codigoActivo ?? a.codigoactivo ?? 0) - Number(b.codigoActivo ?? b.codigoactivo ?? 0));

      if (allActivos.length === 0) {
        toast({ title: "Sin datos", description: "No hay activos encontrados en estado baja con ese criterio.", variant: "destructive" });
        return;
      }

      toast({ title: "Generando Excel", description: `Construyendo reporte con ${allActivos.length} activos...` });

      const dateStr = new Date().toISOString().slice(0, 10);
      const totalRevaluo = todoRevaluo
        ? allActivos.reduce((s, a) => s + (Number(a.valorRevaluo ?? a.valorrevaluo) || 0), 0)
        : 0;
      const totalesObsoleto = {
        costoInicial: 0,
        depAcum: 0,
        costoActualizado: 0,
        depActualizada: 0,
        depAcumTotal: 0,
        depPeriodo: 0,
        costoTotal: 0,
        revaluo: 0,
        costoTotalRevaluado: 0,
        depTotal: 0,
        valorNeto: 0,
      };
      const rows = allActivos.map((a, idx) => {
        const codigoActivo = a.codigoActivo ?? a.codigoactivo;
        const tipoRubroAct = a.tipoRubroAct ?? a.tiporubroact;
        const rubroDesc = rubroFromTipo[tipoRubroAct] ?? rubroFromTipo[String(tipoRubroAct)] ?? "";
        const ambCode = String(a.codigoAmbiente ?? a.codigoambiente ?? "").trim();
        const ciRaw = String(a.cirun ?? "").trim();
        const revaluoRaw = a.valorRevaluo ?? a.valorrevaluo;
        const revaluoNum = revaluoRaw === null || revaluoRaw === undefined || String(revaluoRaw).trim() === ""
          ? ""
          : Number(revaluoRaw);
        const depValues = obsoleto ? (() => {
          const costoInicial = parseNum(a.saldoInicialExp ?? a.saldoinicial_exp);
          const depAcum = parseNum(a.depAcumExp ?? a.depacum_exp);
          const costoActualizado = parseNum(a.porDepAnu ?? a.pordepanu);
          const depActualizada = parseNum(a.actDepAcumExp ?? a.actdepacum_exp);
          const depAcumTotal = parseNum(a.depAcumTotalExp ?? a.depacumtotal_exp);
          const costoTotal = parseNum(a.costActualiExp ?? a.costactuali_exp);
          const tasaAnual = resolveTasaFromParams(rubroDesc, paramTasaMap);
          const depMes = tasaAnual != null ? Number((tasaAnual / 12).toFixed(8)) : null;
          const depPeriodo = depMes !== null && costoTotal !== null ? (depMes * 10) * costoTotal : null;
          const revaluo = parseNum(a.valorRevaluo ?? a.valorrevaluo) ?? 0;
          const costoTotalRevaluado = costoTotal !== null ? costoTotal + revaluo : null;
          const depTotal = depAcumTotal !== null && depPeriodo !== null ? depAcumTotal + depPeriodo : null;
          const valorNeto = costoTotalRevaluado !== null && depTotal !== null ? costoTotalRevaluado - depTotal : null;

          let depPeriodoMostrar = depPeriodo;
          let depTotalMostrar = depTotal;
          let valorNetoMostrar = valorNeto;
          if (recalcular && valorNeto !== null && valorNeto < 0) {
            depPeriodoMostrar = 1;
            depTotalMostrar = depAcumTotal !== null ? depAcumTotal + 1 : null;
            valorNetoMostrar = costoTotalRevaluado !== null && depTotalMostrar !== null ? costoTotalRevaluado - depTotalMostrar : null;
          }

          totalesObsoleto.costoInicial += costoInicial ?? 0;
          totalesObsoleto.depAcum += depAcum ?? 0;
          totalesObsoleto.costoActualizado += costoActualizado ?? 0;
          totalesObsoleto.depActualizada += depActualizada ?? 0;
          totalesObsoleto.depAcumTotal += depAcumTotal ?? 0;
          totalesObsoleto.depPeriodo += depPeriodoMostrar ?? 0;
          totalesObsoleto.costoTotal += costoTotal ?? 0;
          totalesObsoleto.revaluo += revaluo ?? 0;
          totalesObsoleto.costoTotalRevaluado += costoTotalRevaluado ?? 0;
          totalesObsoleto.depTotal += depTotalMostrar ?? 0;
          totalesObsoleto.valorNeto += valorNetoMostrar ?? 0;

          return [
            costoInicial ?? "",
            depAcum ?? "",
            costoActualizado ?? "",
            depActualizada ?? "",
            depAcumTotal ?? "",
            depMes ?? "",
            depPeriodoMostrar ?? "",
            costoTotal ?? "",
            revaluo,
            costoTotalRevaluado ?? "",
            depTotalMostrar ?? "",
            valorNetoMostrar ?? "",
          ];
        })() : [];
        return [
          idx + 1,
          codigoActivo != null ? `OJ-02-${codigoActivo}` : "—",
          clean(rubroDesc),
          clean(tipoRubroDescMap[tipoRubroAct] ?? tipoRubroDescMap[String(tipoRubroAct)]),
          clean(a.descripcionActivo ?? a.descripcionactivo),
          clean(ubicacionMap[ambCode] || ambCode),
          clean(responsableNameOf(ciRaw)),
          ciRaw || "—",
          ...(todoRevaluo ? [Number.isFinite(revaluoNum) ? revaluoNum : ""] : []),
          ...(todoRevaluo
            ? [resolveAniosAsignados(rubroDesc, a.estadoconservacion ?? a.estadoConservacion, vidaUtilPorRubro) ?? ""]
            : []),
          ...depValues,
        ];
      });

      const sheetData = [
        [encontradosEnBajaFisicamente ? "ENCONTRADOS EN BAJA FISICAMENTE - ÓRGANO JUDICIAL" : encontradosFisicamente ? "ENCONTRADOS FISICAMENTE - ÓRGANO JUDICIAL" : revaluo1355 ? "REVALUO 1355 - ÓRGANO JUDICIAL" : revaluo2553 ? "REVALUO 2553 - ÓRGANO JUDICIAL" : todoRevaluo ? "TODO REVALUO - ÓRGANO JUDICIAL" : recalcular && obsoleto ? "RECALCULAR OBSOLETO - ÓRGANO JUDICIAL" : obsoleto ? "OBSOLETO - ÓRGANO JUDICIAL" : estabanEnBaja ? "ACTIVOS QUE ESTABAN EN BAJA - ÓRGANO JUDICIAL" : enAlta ? "ENCONTRADO BAJA SI SON ACTIVOS - ÓRGANO JUDICIAL" : soloActivos ? "ENCONTRADO BAJA SI SON ACTIVOS - ÓRGANO JUDICIAL" : soloNoActivos ? "ENCONTRADOS BAJA NO SON ACTIVOS - ÓRGANO JUDICIAL" : "ENCONTRADOS EN ESTADO BAJA - ÓRGANO JUDICIAL"],
        [`Total activos: ${allActivos.length}`],
        [`Fecha: ${dateStr}`],
        [],
        obsoleto ? OBSOLETO_HEADERS : todoRevaluo ? TODO_REVALUO_HEADERS : HEADERS,
        ...rows,
        [
          "", "", "", "", "", "", "TOTAL", allActivos.length,
          ...(todoRevaluo ? [totalRevaluo, ""] : []),
          ...(obsoleto ? [
            totalesObsoleto.costoInicial,
            totalesObsoleto.depAcum,
            totalesObsoleto.costoActualizado,
            totalesObsoleto.depActualizada,
            totalesObsoleto.depAcumTotal,
            "",
            totalesObsoleto.depPeriodo,
            totalesObsoleto.costoTotal,
            totalesObsoleto.revaluo,
            totalesObsoleto.costoTotalRevaluado,
            totalesObsoleto.depTotal,
            totalesObsoleto.valorNeto,
          ] : []),
        ],
      ];

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws["!cols"] = obsoleto
        ? [
            { wch: 6 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 26 }, { wch: 14 }, { wch: 12 }, { wch: 10 },
            { wch: 12 }, { wch: 12 }, { wch: 11 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 13 }, { wch: 12 },
            { wch: 13 }, { wch: 12 }, { wch: 12 },
          ]
        : todoRevaluo
        ? [{ wch: 6 }, { wch: 16 }, { wch: 26 }, { wch: 26 }, { wch: 55 }, { wch: 45 }, { wch: 30 }, { wch: 16 }, { wch: 18 }, { wch: 14 }]
        : [{ wch: 6 }, { wch: 16 }, { wch: 28 }, { wch: 30 }, { wch: 70 }, { wch: 50 }, { wch: 32 }, { wch: 16 }];
      if (todoRevaluo) {
        const moneyFormat = "0.0000";
        for (let i = 0; i <= allActivos.length; i++) {
          const cell = ws[XLSX.utils.encode_cell({ r: 5 + i, c: 8 })];
          if (cell && cell.t === "n") cell.z = moneyFormat;
        }
      }
      if (obsoleto) {
        const moneyFormat = "0.0000";
        const mesFormat = "0.00000000";
        for (let i = 0; i <= allActivos.length; i++) {
          const r = 5 + i;
          for (const c of [8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19]) {
            const cell = ws[XLSX.utils.encode_cell({ r, c })];
            if (cell && cell.t === "n") cell.z = moneyFormat;
          }
          const mesCell = ws[XLSX.utils.encode_cell({ r, c: 13 })];
          if (mesCell && mesCell.t === "n") mesCell.z = mesFormat;
        }
      }
      ws["!pageSetup"] = { orientation: "landscape", paperSize: 1, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
      ws["!margins"] = { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, encontradosEnBajaFisicamente ? "Encontrados En Baja Fisicamente" : encontradosFisicamente ? "Encontrados Fisicamente" : revaluo1355 ? "Revaluo 1355" : revaluo2553 ? "Revaluo 2553" : todoRevaluo ? "Todo Revaluo" : recalcular && obsoleto ? "Recalcular Obsoleto" : obsoleto ? "Obsoleto" : estabanEnBaja ? "Activos Baja" : enAlta ? "Encontrado Activos" : soloActivos ? "Encontrado Activos" : soloNoActivos ? "Encontrados No Activos" : "Encontrados Baja");
      XLSX.writeFile(wb, encontradosEnBajaFisicamente ? `Encontrados_En_Baja_Fisicamente_${dateStr}.xlsx` : encontradosFisicamente ? `Encontrados_Fisicamente_${dateStr}.xlsx` : revaluo1355 ? `Revaluo_1355_${dateStr}.xlsx` : revaluo2553 ? `Revaluo_2553_${dateStr}.xlsx` : todoRevaluo ? `Todo_Revaluo_${dateStr}.xlsx` : recalcular && obsoleto ? `Recalcular_Obsoleto_${dateStr}.xlsx` : obsoleto ? `Obsoleto_${dateStr}.xlsx` : estabanEnBaja ? `Activos_Que_Estaban_En_Baja_${dateStr}.xlsx` : enAlta ? `Encontrado_Baja_Si_Son_Activos_${dateStr}.xlsx` : soloActivos ? `Encontrado_Baja_Si_Son_Activos_${dateStr}.xlsx` : soloNoActivos ? `Encontrados_Baja_No_Son_Activos_${dateStr}.xlsx` : `Encontrados_Estado_Baja_${dateStr}.xlsx`);

      toast({ title: "Reporte generado", description: `Se exportaron ${allActivos.length} activos.` });
    } catch (err) {
      console.error("Error generando Encontrados en Estado Baja (Excel)", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
