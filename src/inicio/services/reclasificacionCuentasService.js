import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { buildParamTasaMap, resolveTasaFromParams } from "../constants/depreciacionConstants";

const FILE_URL = `${import.meta.env.BASE_URL}Reclasificar.xlsx`;

export const DEPRECIACION_HEADERS = [
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

const parseNum = (v) => {
  if (v === null || v === undefined || String(v).trim() === "") return 0;
  const n = Number(String(v).replace(",", "."));
  return isNaN(n) ? 0 : n;
};

const digits = (v) => Number(String(v ?? "").replace(/\D/g, "")) || 0;

const cleanHeader = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

const norm = (v) =>
  cleanHeader(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const REMOVE_DETAIL_COLUMNS = new Set(["codigo interno", "tipo actual", "tipo destino"]);

const hasData = (row) => (row || []).some((cell) => String(cell ?? "").trim() !== "");

const findHeaderIndex = (rows, required) =>
  rows.findIndex((row) => {
    const headers = new Set((row || []).map(norm));
    return required.every((name) => headers.has(name));
  });

const extractTable = (rows, required, removed = new Set()) => {
  const headerIndex = findHeaderIndex(rows, required);
  if (headerIndex < 0) {
    throw new Error(`No se encontró la cabecera esperada: ${required.join(", ")}`);
  }

  const headers = (rows[headerIndex] || []).map(cleanHeader);
  const keepIndexes = headers
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => header && !removed.has(norm(header)))
    .map(({ index }) => index);

  const dataRows = rows.slice(headerIndex + 1).filter(hasData);
  const preHeader = rows
    .slice(0, headerIndex)
    .map((row) => cleanHeader(row?.[0]))
    .filter(Boolean);

  return {
    title: preHeader[0] || "",
    meta: preHeader.slice(1),
    headers: keepIndexes.map((index) => headers[index]),
    rows: dataRows.map((row) => keepIndexes.map((index) => row?.[index] ?? "")),
    sourceHeaders: headers,
    sourceRows: dataRows,
  };
};

const fetchActivosDepreciacion = async (column, values, onlyCurrent = false) => {
  const map = new Map();
  const CHUNK = 200;
  for (let i = 0; i < values.length; i += CHUNK) {
    const chunk = values.slice(i, i + CHUNK);
    let query = supabase
      .from("act_activos")
      .select("codigoactivo,codigoactivointerno,saldoinicial_exp,depacum_exp,pordepanu,actdepacum_exp,depacumtotal_exp,costactuali_exp,valorrevaluo")
      .in(column, chunk);
    if (onlyCurrent) query = query.eq("ultimoregistro", 1);
    const { data, error } = await query;
    if (error) throw error;
    (data || []).forEach((activo) => map.set(Number(activo[column]), activo));
  }
  return map;
};

/**
 * Agrega al detalle las mismas 12 columnas del reporte DEPRECIACION,
 * aplicando el recálculo de Valor Neto negativo solo a estos activos.
 */
const enrichDetalleWithDepreciacion = async (detalle) => {
  const codeIndex = detalle.headers.findIndex((header) => norm(header) === "codigo activo");
  const rubroIndex = detalle.headers.findIndex((header) => norm(header) === "rubro actual");
  const internalIndex = detalle.sourceHeaders.findIndex((header) => norm(header) === "codigo interno");
  const codes = [...new Set(detalle.rows.map((row) => digits(row[codeIndex])).filter(Boolean))];
  const internalCodes = [
    ...new Set(detalle.sourceRows.map((row) => digits(row?.[internalIndex])).filter(Boolean)),
  ];

  const [{ data: paramData, error: paramError }, byInternal, byCode] = await Promise.all([
    supabase.from("act_param_depreciacion").select("rubro,tasa_anual"),
    internalIndex >= 0
      ? fetchActivosDepreciacion("codigoactivointerno", internalCodes)
      : Promise.resolve(new Map()),
    fetchActivosDepreciacion("codigoactivo", codes, true),
  ]);
  if (paramError) throw paramError;
  const paramTasaMap = buildParamTasaMap(paramData || []);

  const rows = detalle.rows.map((row, i) => {
    const internal = digits(detalle.sourceRows[i]?.[internalIndex]);
    const activo = byInternal.get(internal) || byCode.get(digits(row[codeIndex]));
    if (!activo) return [...row, ...DEPRECIACION_HEADERS.map(() => null)];

    const saldoInicial = parseNum(activo.saldoinicial_exp);
    const depAcum = parseNum(activo.depacum_exp);
    const costoAct = parseNum(activo.pordepanu);
    const depActualizada = parseNum(activo.actdepacum_exp);
    const depAcumTotal = parseNum(activo.depacumtotal_exp);
    const costoTotal0910 = parseNum(activo.costactuali_exp);
    const revaluo = parseNum(activo.valorrevaluo);
    const costoTotalRevaluado = costoTotal0910 + revaluo;

    const tasaAnual = resolveTasaFromParams(row[rubroIndex], paramTasaMap);
    const depMesRaw = tasaAnual !== null && tasaAnual !== undefined ? tasaAnual / 12 : null;
    const depMes = depMesRaw !== null && depMesRaw !== undefined ? Number(depMesRaw.toFixed(8)) : null;
    const depPeriodo = depMes !== null ? (depMes * 10) * costoTotal0910 : null;
    const depTotal = depPeriodo !== null ? depAcumTotal + depPeriodo : null;
    const valorNeto = depTotal !== null ? costoTotalRevaluado - depTotal : null;

    let depPeriodoMostrar = depPeriodo;
    let depTotalMostrar = depTotal;
    let valorNetoMostrar = valorNeto;
    if (valorNeto !== null && valorNeto < 0) {
      depPeriodoMostrar = 1;
      depTotalMostrar = depAcumTotal + 1;
      valorNetoMostrar = costoTotalRevaluado - depTotalMostrar;
    }

    return [
      ...row,
      saldoInicial,
      depAcum,
      costoAct,
      depActualizada,
      depAcumTotal,
      depMes,
      depPeriodoMostrar,
      costoTotal0910,
      revaluo,
      costoTotalRevaluado,
      depTotalMostrar,
      valorNetoMostrar,
    ];
  });

  return {
    ...detalle,
    headers: [...detalle.headers, ...DEPRECIACION_HEADERS],
    rows,
  };
};

/**
 * Agrega al resumen los totales de las columnas de depreciación,
 * agrupados por la descripción del activo. La tasa %Dep. Mes no se suma.
 */
const enrichResumenWithDepreciacion = (resumen, detalle) => {
  const typeIndex = resumen.headers.findIndex((header) => norm(header) === "tipo (descripcion)");
  const descIndex = detalle.headers.findIndex((header) => norm(header) === "tipo actual desc");
  const depStart = detalle.headers.length - DEPRECIACION_HEADERS.length;

  const byType = new Map();
  const totals = DEPRECIACION_HEADERS.map(() => 0);
  detalle.rows.forEach((row) => {
    const key = norm(row[descIndex]);
    if (!byType.has(key)) byType.set(key, DEPRECIACION_HEADERS.map(() => 0));
    const group = byType.get(key);
    DEPRECIACION_HEADERS.forEach((_, j) => {
      if (j === 5) return;
      const value = parseNum(row[depStart + j]);
      group[j] += value;
      totals[j] += value;
    });
  });

  const rows = resumen.rows.map((row) => {
    const isTotal = norm(row[typeIndex]) === "total";
    const values = isTotal
      ? totals
      : byType.get(norm(row[typeIndex])) || DEPRECIACION_HEADERS.map(() => 0);
    return [...row, ...values.map((value, j) => (j === 5 ? null : value))];
  });

  return {
    ...resumen,
    headers: [...resumen.headers, ...DEPRECIACION_HEADERS],
    rows,
  };
};

/**
 * Lee public/Reclasificar.xlsx y devuelve la estructura del reporte:
 * { resumen, detalle }. Al detalle se le quitan las columnas
 * Código Interno, Tipo Actual y Tipo Destino, y se le agregan las
 * columnas de depreciación recalculadas para los activos del archivo.
 */
export const fetchReclasificacionCuentas = async () => {
  const response = await fetch(FILE_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`No se pudo leer el archivo ${FILE_URL} (${response.status})`);
  }

  const workbook = XLSX.read(await response.arrayBuffer(), { type: "array" });
  const resumenSheet = workbook.Sheets["Resumen"] || workbook.Sheets[workbook.SheetNames[0]];
  const detalleSheet = workbook.Sheets["Detalle"] || workbook.Sheets[workbook.SheetNames[1]];

  if (!resumenSheet || !detalleSheet) {
    throw new Error("El archivo Reclasificar.xlsx no contiene las hojas Resumen y Detalle.");
  }

  const resumenRows = XLSX.utils.sheet_to_json(resumenSheet, { header: 1, defval: "" });
  const detalleRows = XLSX.utils.sheet_to_json(detalleSheet, { header: 1, defval: "" });

  const detalleBase = extractTable(detalleRows, ["codigo activo", "descripcion activo"], REMOVE_DETAIL_COLUMNS);
  const detalle = await enrichDetalleWithDepreciacion(detalleBase);
  const resumen = extractTable(resumenRows, ["tipo (descripcion)", "destino sugerido"]);

  return {
    resumen: enrichResumenWithDepreciacion(resumen, detalle),
    detalle,
  };
};
