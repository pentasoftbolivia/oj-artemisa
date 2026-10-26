import { useState, useCallback } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/lib/supabase";
import { getCachedCatalog } from "@/lib/catalogCache";
import { toCamelCaseArray } from "@/lib/mapFields";
import { useToast } from "@/hooks/use-toast";
import { LOGO_JPG_DATA_URL } from "@/lib/logoJpgBase64";
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

const LOGO_W = 32;
const LOGO_H = LOGO_W * (57 / 256);

const fmtMoney = (v) => {
  if (v === null || v === undefined || String(v).trim() === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("es-BO", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
};

const fmtMes = (v) => {
  if (v === null || v === undefined || String(v).trim() === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("es-BO", { minimumFractionDigits: 8, maximumFractionDigits: 8 });
};

const fmtAnios = (v) => (v === null || v === undefined || v === "" ? "—" : String(v));

const parseNum = (v) => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

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

const addLogo = (doc) => {
  try {
    doc.addImage(LOGO_JPG_DATA_URL, "JPEG", 14, 8, LOGO_W, LOGO_H);
  } catch {
    // El logo es opcional: si falla la carga, se genera el PDF sin logo.
  }
};

/**
 * Reporte ENCONTRADOS EN ESTADO BAJA (PDF).
 * Criterio exacto: codigoactivo <= 43753
 * AND estadoinventario IS NOT NULL AND estadoinventario <> ''
 * AND artemisaaltabaja=0 AND ultimoregistro=1.
 * Columnas básicas: Código Activo, Rubro, Tipo Rubro, Descripción,
 * Ubicación, Responsable y Carnet. Orden: codigoactivo ASC.
 */
export const useReporteEncontradosBaja = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async (options = {}) => {
  const soloActivos = options?.soloActivos === true;
  const soloNoActivos = options?.soloNoActivos === true;
  const enAlta = options?.enAlta === true;
  const estabanEnBaja = options?.estabanEnBaja === true;
  const obsoleto = options?.obsoleto === true;
  const faltantes = options?.faltantes === true;
  const recalcular = options?.recalcular === true;
  const todoRevaluo = options?.todoRevaluo === true;
  const revaluo2553 = options?.revaluo2553 === true;
  const revaluo1355 = options?.revaluo1355 === true;
  const encontradosFisicamente = options?.encontradosFisicamente === true;
  const encontradosEnBajaFisicamente = options?.encontradosEnBajaFisicamente === true;
  // Obsoleto y Faltantes comparten las 12 columnas de depreciación y el ajuste
  // de Valor Neto negativo.
  const conDep = obsoleto || faltantes;
    setIsGenerating(true);
    try {
      toast({ title: "Generando Encontrados en Estado Baja", description: "Cargando catálogos..." });

      const paramDepPromise = conDep
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
            .select(`${ACTIVO_COLUMNS},artemisaaltabaja,esactivo,estadoconservacion,activonuevo,pararevaluo,valorrevaluo${conDep ? ",saldoinicial_exp,depacum_exp,pordepanu,actdepacum_exp,depacumtotal_exp,costactuali_exp" : ""}`);
          if (todoRevaluo) {
            // OR exacto de los 3 grupos de revalúo. Sin los filtros base globales:
            // el grupo 3 solo exige activonuevo=true.
            query = query.or([
              "and(codigoactivo.lte.43753,artemisaaltabaja.eq.0,ultimoregistro.eq.1,esactivo.eq.true,estadoconservacion.neq.MALO)",
              "and(codigoactivo.lte.43753,artemisaaltabaja.eq.1,pararevaluo.eq.true,activonuevo.eq.false,estadoconservacion.neq.MALO)",
              "activonuevo.eq.true",
            ].join(","));
          } else if (faltantes) {
            // Mismo criterio que FALTANTES EN ESTADO ACTIVO:
            // codigoactivo <= 43753 y artemisaaltabaja=1 (sin filtro ultimoregistro).
            // El estadoinventario NULL/vacío se refuerza en cliente.
            query = query.lte("codigoactivo", 43753).eq("artemisaaltabaja", 1);
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
      // Refuerzo en cliente: codigoactivo <= 43753, estadoinventario con dato,
      // artemisaaltabaja=0 y ultimoregistro=1
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
        if (faltantes) {
          const estInv = String(a.estadoinventario ?? a.estadoInventario ?? "").trim();
          if (estInv !== "") return false;
          const v = a.artemisaaltabaja ?? a.artemisaAltaBaja;
          const codigoActivo = Number(a.codigoActivo ?? a.codigoactivo ?? 0);
          return Number(v) === 1 && codigoActivo <= 43753;
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

      const totalRevaluo = todoRevaluo
        ? allActivos.reduce((s, a) => s + (Number(a.valorRevaluo ?? a.valorrevaluo) || 0), 0)
        : 0;

      if (allActivos.length === 0) {
        toast({ title: "Sin datos", description: "No hay activos encontrados en estado baja con ese criterio.", variant: "destructive" });
        return;
      }

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

      const body = allActivos.map((a, idx) => {
        const codigoActivo = a.codigoActivo ?? a.codigoactivo;
        const tipoRubroAct = a.tipoRubroAct ?? a.tiporubroact;
        const rubroDesc = rubroFromTipo[tipoRubroAct] ?? rubroFromTipo[String(tipoRubroAct)] ?? "—";
        const tipoDesc = tipoRubroDescMap[tipoRubroAct] ?? tipoRubroDescMap[String(tipoRubroAct)] ?? "—";
        const ambCode = String(a.codigoAmbiente ?? a.codigoambiente ?? "").trim();
        const ciRaw = String(a.cirun ?? "").trim();
        const depValues = conDep ? (() => {
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
            fmtMoney(costoInicial),
            fmtMoney(depAcum),
            fmtMoney(costoActualizado),
            fmtMoney(depActualizada),
            fmtMoney(depAcumTotal),
            fmtMes(depMes),
            fmtMoney(depPeriodoMostrar),
            fmtMoney(costoTotal),
            fmtMoney(revaluo),
            fmtMoney(costoTotalRevaluado),
            fmtMoney(depTotalMostrar),
            fmtMoney(valorNetoMostrar),
          ];
        })() : [];
        return [
          String(idx + 1),
          codigoActivo != null ? `OJ-02-${codigoActivo}` : "—",
          String(rubroDesc || "—"),
          String(tipoDesc || "—"),
          String(a.descripcionActivo ?? a.descripcionactivo ?? "—"),
          String(ubicacionMap[ambCode] || ambCode || "—"),
          String(responsableNameOf(ciRaw)),
          ciRaw || "—",
          ...(todoRevaluo ? [fmtMoney(a.valorRevaluo ?? a.valorrevaluo)] : []),
          ...(todoRevaluo
            ? [fmtAnios(resolveAniosAsignados(rubroDesc, a.estadoconservacion ?? a.estadoConservacion, vidaUtilPorRubro))]
            : []),
          ...depValues,
        ];
      });

      toast({ title: "Generando PDF", description: `Construyendo reporte con ${allActivos.length} activos...` });

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      addLogo(doc);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(encontradosEnBajaFisicamente ? "ENCONTRADOS EN BAJA FISICAMENTE - ÓRGANO JUDICIAL" : encontradosFisicamente ? "ENCONTRADOS FISICAMENTE - ÓRGANO JUDICIAL" : revaluo1355 ? "REVALUO 1355 - ÓRGANO JUDICIAL" : revaluo2553 ? "REVALUO 2553 - ÓRGANO JUDICIAL" : todoRevaluo ? "TODO REVALUO - ÓRGANO JUDICIAL" : recalcular && faltantes ? "RECALCULAR FALTANTES - ÓRGANO JUDICIAL" : faltantes ? "FALTANTES EN ESTADO ACTIVO - ÓRGANO JUDICIAL" : recalcular && obsoleto ? "RECALCULAR OBSOLETO - ÓRGANO JUDICIAL" : obsoleto ? "OBSOLETO - ÓRGANO JUDICIAL" : estabanEnBaja ? "ACTIVOS QUE ESTABAN EN BAJA - ÓRGANO JUDICIAL" : enAlta ? "ENCONTRADO BAJA SI SON ACTIVOS - ÓRGANO JUDICIAL" : soloActivos ? "ENCONTRADO BAJA SI SON ACTIVOS - ÓRGANO JUDICIAL" : soloNoActivos ? "ENCONTRADOS BAJA NO SON ACTIVOS - ÓRGANO JUDICIAL" : "ENCONTRADOS EN ESTADO BAJA - ÓRGANO JUDICIAL", pageWidth / 2, 16, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Total activos: ${allActivos.length}`, pageWidth / 2, 21, { align: "center" });

      autoTable(doc, {
        startY: 26,
        head: [[
          "N°", "Código Activo", "Rubro", "Tipo Rubro", "Descripción", "Ubicación", "Responsable", "Carnet",
          ...(todoRevaluo ? ["Valor Revalúo", "Años Asignados"] : []),
          ...(conDep ? OBSOLETO_DEP_HEADERS : []),
        ]],
        body,
        foot: [[
          "", "", "", "", "", "", "TOTAL", String(allActivos.length),
          ...(todoRevaluo ? [fmtMoney(totalRevaluo), ""] : []),
          ...(conDep ? [
            fmtMoney(totalesObsoleto.costoInicial),
            fmtMoney(totalesObsoleto.depAcum),
            fmtMoney(totalesObsoleto.costoActualizado),
            fmtMoney(totalesObsoleto.depActualizada),
            fmtMoney(totalesObsoleto.depAcumTotal),
            "",
            fmtMoney(totalesObsoleto.depPeriodo),
            fmtMoney(totalesObsoleto.costoTotal),
            fmtMoney(totalesObsoleto.revaluo),
            fmtMoney(totalesObsoleto.costoTotalRevaluado),
            fmtMoney(totalesObsoleto.depTotal),
            fmtMoney(totalesObsoleto.valorNeto),
          ] : []),
        ]],
        showFoot: "lastPage",
        theme: "striped",
        styles: { font: "helvetica", fontSize: conDep ? 6 : 7, cellPadding: conDep ? 1 : 1.5, overflow: "linebreak", valign: "middle" },
        headStyles: { fillColor: [16, 70, 140], textColor: [255, 255, 255], halign: "center", fontStyle: "bold", fontSize: conDep ? 6 : 7 },
        footStyles: { fillColor: [230, 240, 255], textColor: [16, 70, 140], halign: "center", fontStyle: "bold", fontSize: conDep ? 7 : 8 },
        columnStyles: conDep
          ? {
              0: { cellWidth: 7, halign: "center" },
              1: { cellWidth: 12, halign: "center" },
              2: { cellWidth: 12, halign: "left" },
              3: { cellWidth: 12, halign: "left" },
              4: { cellWidth: 26, halign: "left" },
              5: { cellWidth: 14, halign: "left" },
              6: { cellWidth: 12, halign: "left" },
              7: { cellWidth: 10, halign: "center" },
              8: { cellWidth: 12, halign: "right" },
              9: { cellWidth: 12, halign: "right" },
              10: { cellWidth: 11, halign: "right" },
              11: { cellWidth: 12, halign: "right" },
              12: { cellWidth: 12, halign: "right" },
              13: { cellWidth: 12, halign: "right" },
              14: { cellWidth: 12, halign: "right" },
              15: { cellWidth: 13, halign: "right" },
              16: { cellWidth: 12, halign: "right" },
              17: { cellWidth: 13, halign: "right" },
              18: { cellWidth: 12, halign: "right" },
              19: { cellWidth: 12, halign: "right" },
            }
          : todoRevaluo
          ? {
              0: { cellWidth: 9, halign: "center" },
              1: { cellWidth: 20, halign: "center" },
              2: { cellWidth: 28, halign: "left" },
              3: { cellWidth: 28, halign: "left" },
              4: { cellWidth: 48, halign: "left" },
              5: { cellWidth: 38, halign: "left" },
              6: { cellWidth: 32, halign: "left" },
              7: { cellWidth: 16, halign: "center" },
              8: { cellWidth: 24, halign: "right" },
              9: { cellWidth: 14, halign: "center" },
            }
          : {
              0: { cellWidth: 10, halign: "center" },
              1: { cellWidth: 22, halign: "center" },
              2: { cellWidth: 32, halign: "left" },
              3: { cellWidth: 34, halign: "left" },
              4: { cellWidth: 60, halign: "left" },
              5: { cellWidth: 50, halign: "left" },
              6: { cellWidth: 40, halign: "left" },
              7: { cellWidth: 20, halign: "center" },
            },
        margin: { top: 26, left: 8, right: 8 },
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

      doc.save(encontradosEnBajaFisicamente ? "Encontrados_En_Baja_Fisicamente.pdf" : encontradosFisicamente ? "Encontrados_Fisicamente.pdf" : revaluo1355 ? "Revaluo_1355.pdf" : revaluo2553 ? "Revaluo_2553.pdf" : todoRevaluo ? "Todo_Revaluo.pdf" : recalcular && faltantes ? "Recalcular_Faltantes.pdf" : faltantes ? "Faltantes_Estado_Activo.pdf" : recalcular && obsoleto ? "Recalcular_Obsoleto.pdf" : obsoleto ? "Obsoleto.pdf" : estabanEnBaja ? "Activos_Que_Estaban_En_Baja.pdf" : enAlta ? "Encontrado_Baja_Si_Son_Activos.pdf" : soloActivos ? "Encontrado_Baja_Si_Son_Activos.pdf" : soloNoActivos ? "Encontrados_Baja_No_Son_Activos.pdf" : "Encontrados_Estado_Baja.pdf");
      toast({ title: "Reporte generado", description: `Se exportaron ${allActivos.length} activos.` });
    } catch (err) {
      console.error("Error generando Encontrados en Estado Baja", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
