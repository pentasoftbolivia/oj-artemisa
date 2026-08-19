import { supabase } from "@/lib/supabase";

const NO_MATCH = [-1];
const CHUNK_SIZE = 1000;

const fetchColumnPaginated = async ({ table, column, match }) => {
  const all = [];
  let start = 0;
  for (;;) {
    let query = supabase
      .from(table)
      .select(column)
      .order(column, { ascending: true })
      .range(start, start + CHUNK_SIZE - 1);
    if (match) {
      if (match.operator === "in") {
        query = query.in(match.column, match.values);
      } else {
        query = query.eq(match.column, match.value);
      }
    }
    const { data, error } = await query;
    if (error) throw error;
    const rows = data || [];
    all.push(...rows);
    if (rows.length < CHUNK_SIZE) break;
    start += CHUNK_SIZE;
  }
  return all;
};

const fetchAmbientesByNivelCodes = async (nivelCodes) => {
  if (!nivelCodes || nivelCodes.length === 0) return NO_MATCH;
  const rows = await fetchColumnPaginated({
    table: "act_ambiente",
    column: "codigoambiente",
    match: { column: "codigonivel", operator: "in", values: nivelCodes },
  });
  const codes = rows.map((a) => a.codigoambiente);
  return codes.length > 0 ? codes : NO_MATCH;
};

const fetchNivelesByInmuebleCodes = async (inmuebleCodes) => {
  if (!inmuebleCodes || inmuebleCodes.length === 0) return NO_MATCH;
  const rows = await fetchColumnPaginated({
    table: "act_nivel",
    column: "codigonivel",
    match: { column: "codigoinmueble", operator: "in", values: inmuebleCodes },
  });
  return rows.map((n) => n.codigonivel);
};

/**
 * Resuelve la lista de codigos de ambiente que pertenecen a la ubicacion
 * seleccionada. En cascada, la ubicacion mas especifica tiene prioridad:
 * nivel > inmueble > ciudad. Cuando se selecciona una ubicacion, las
 * demas quedan vacias en el flujo normal, pero si conviven (ej. ciudad e
 * inmueble en el resumen independiente) gana el inmueble.
 *
 * @returns {Promise<number[] | null>} Lista de codigos de ambiente o null si no hay filtro.
 */
export const resolveAmbienteCodes = async ({
  ciudad = "",
  inmueble = "",
  nivel = "",
} = {}) => {
  if (nivel) {
    const rows = await fetchColumnPaginated({
      table: "act_ambiente",
      column: "codigoambiente",
      match: { column: "codigonivel", operator: "eq", value: nivel },
    });
    const codes = rows.map((a) => a.codigoambiente);
    return codes.length > 0 ? codes : NO_MATCH;
  }

  if (inmueble) {
    const nivelRows = await fetchColumnPaginated({
      table: "act_nivel",
      column: "codigonivel",
      match: { column: "codigoinmueble", operator: "eq", value: inmueble },
    });
    const nivelCodes = nivelRows.map((n) => n.codigonivel);
    return fetchAmbientesByNivelCodes(nivelCodes);
  }

  if (ciudad) {
    const inmuebleRows = await fetchColumnPaginated({
      table: "act_inmueble",
      column: "codigoinmueble",
      match: { column: "codigociudad", operator: "eq", value: ciudad },
    });
    const inmuebleCodes = inmuebleRows.map((i) => i.codigoinmueble);
    const nivelCodes = await fetchNivelesByInmuebleCodes(inmuebleCodes);
    return fetchAmbientesByNivelCodes(nivelCodes);
  }

  return null;
};

/**
 * Cuenta los activos (act_activos) que pertenecen a la ubicacion filtrada
 * (ciudad | inmueble | nivel | ambiente). Incluye todos los valores de
 * estadoinventario (incluso vacios) y solo considera ultimoregistro = 1.
 * Sin filtro de ubicacion devuelve el total de activos del inventario.
 *
 * @returns {Promise<number>} Cantidad de activos encontrados segun el filtro.
 */
export const countActivosByUbicacion = async ({
  ciudad = "",
  inmueble = "",
  nivel = "",
  ambiente = "",
} = {}) => {
  let query = supabase
    .from("act_activos")
    .select("codigoactivointerno", { count: "exact", head: true })
    .eq("ultimoregistro", 1);

  let codes = null;
  if (ambiente.trim()) {
    codes = [ambiente.trim()];
  } else if (ciudad.trim() || inmueble.trim() || nivel.trim()) {
    codes = await resolveAmbienteCodes({ ciudad, inmueble, nivel });
  }

  if (codes != null) {
    query = query.in("codigoambiente", codes.length > 0 ? codes : [-1]);
  }

  const { count, error } = await query;
  if (error) {
    console.error("Error counting activos by ubicacion:", error);
    return 0;
  }
  return count || 0;
};
