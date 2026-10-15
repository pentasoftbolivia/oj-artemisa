/**
 * Parámetros de DEPRECIACIÓN ANUAL por RUBRO — PRODUCTO 3 (reporte DEPRECIACION).
 * La tasa se resuelve por palabra clave sobre la descripción del rubro
 * (mayúsculas, sin tildes) para tolerar variantes singular/plural en BD.
 */
export const DEPRECIACION_POR_RUBRO = [
  { label: "EQUIPO DE COMUNICACIONES", tasa: 0.125, match: [/COMUNICACION/] },
  { label: "EQUIPO DE OFICINA Y MUEBLES", tasa: 0.1, match: [/OFICINA/] },
  { label: "EQUIPO EDUCACIONAL Y RECREATIVO", tasa: 0.125, match: [/EDUCACIONAL/] },
  { label: "EQUIPOS DE COMPUTACION", tasa: 0.25, match: [/COMPUTACION/] },
  { label: "EQUIPOS DE TRANSPORTE TRACCION Y ELEVACION", tasa: 0.2, match: [/TRANSPORTE|TRACCION|ELEVACION/] },
  { label: "MAQUINARIA Y EQUIPO DE PRODUCCION", tasa: 0.125, match: [/PRODUCCION/] },
  { label: "OTRA MAQUINARIA Y EQUIPO", tasa: 0.125, match: [/OTRA MAQUINARIA/] },
  { label: "OTROS ACTIVOS FIJOS", tasa: 0.2, match: [/OTROS ACTIVOS FIJOS/] },
];

const normRubroDep = (s) =>
  String(s || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Devuelve la tasa anual (0.125, 0.1, ...) según el rubro, o null si no hay parámetro.
 */
export const resolveTasaDepreciacion = (rubroDesc) => {
  const n = normRubroDep(rubroDesc);
  if (!n) return null;
  const found = DEPRECIACION_POR_RUBRO.find((p) => p.match.some((re) => re.test(n)));
  return found ? found.tasa : null;
};

/**
 * Arma el mapa { rubroNormalizado: tasa } desde las filas de act_param_depreciacion.
 */
export const buildParamTasaMap = (rows) => {
  const map = {};
  (rows || []).forEach((r) => {
    const key = normRubroDep(r.rubro);
    const tasa = Number(String(r.tasa_anual ?? r.tasaAnual ?? "").replace(",", "."));
    if (key && !isNaN(tasa)) map[key] = tasa;
  });
  return map;
};

/**
 * Resuelve la tasa anual usando la tabla act_param_depreciacion:
 * ubica el parámetro por palabra clave y devuelve su tasa_anual.
 * Si el parámetro no está en la tabla, usa la constante como respaldo.
 */
export const resolveTasaFromParams = (rubroDesc, paramMap) => {
  const n = normRubroDep(rubroDesc);
  if (!n) return null;
  const found = DEPRECIACION_POR_RUBRO.find((p) => p.match.some((re) => re.test(n)));
  if (!found) return null;
  const key = normRubroDep(found.label);
  if (paramMap && paramMap[key] !== undefined) return paramMap[key];
  return found.tasa;
};

/**
 * Cálculos por activo:
 * - pctMes = tasa anual / 12
 * - depreciacion = costoActualizado * (pctMes * 10)
 */
export const calcDepreciacion = (costoActualizado, tasaAnual) => {
  const costo = costoActualizado === null || costoActualizado === undefined || String(costoActualizado).trim() === ""
    ? null
    : Number(String(costoActualizado).replace(",", "."));
  const costoNum = costo !== null && !isNaN(costo) ? costo : null;
  if (tasaAnual == null || costoNum == null) {
    return { costo: costoNum, tasa: tasaAnual ?? null, pctMes: tasaAnual != null ? tasaAnual / 12 : null, depreciacion: null };
  }
  const pctMes = tasaAnual / 12;
  return { costo: costoNum, tasa: tasaAnual, pctMes, depreciacion: costoNum * (pctMes * 10) };
};
