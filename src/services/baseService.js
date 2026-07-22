import { supabase } from "@/lib/supabase";

const CHUNK_SIZE = 1000;

export const fetchPaginatedRows = async (
  tableName,
  { page = 1, pageSize = 50, filters = {}, columns = "*", orderBy = { column: "id", ascending: true } } = {}
) => {
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  let query = supabase
    .from(tableName)
    .select(columns, { count: "exact" })
    .order(orderBy.column, { ascending: orderBy.ascending })
    .range(start, end);

  if (filters.search) {
    const search = filters.search.replace(/%/g, "");
    query = query.or(
      `codigo_patrimonial.ilike.%${search}%,denominacion.ilike.%${search}%,numero_serie.ilike.%${search}%,marca.ilike.%${search}%,modelo.ilike.%${search}%`
    );
  }
  if (filters.tipoActivoId) {
    query = query.eq("tipo_activo_id", filters.tipoActivoId);
  }
  if (filters.tipoActivoIds && filters.tipoActivoIds.length > 0) {
    query = query.in("tipo_activo_id", filters.tipoActivoIds);
  }
  if (filters.estado) {
    query = query.eq("estado", filters.estado);
  }
  if (filters.ubicacionActualId) {
    query = query.eq("ubicacion_actual_id", filters.ubicacionActualId);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data || [], totalCount: count || 0 };
};

export const fetchAllRows = async (tableName) => {
  let allData = [];
  let start = 0;
  let chunk;

  do {
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .order("id", { ascending: true })
      .range(start, start + CHUNK_SIZE - 1);
    if (error) throw error;
    chunk = data || [];
    allData = allData.concat(chunk);
    start += CHUNK_SIZE;
  } while (chunk.length === CHUNK_SIZE);

  return allData;
};

export const createRow = async (tableName, rowData) => {
  const { data, error } = await supabase
    .from(tableName)
    .insert(rowData)
    .select("*")
    .single();
  if (error) throw error;
  return data;
};

export const updateRow = async (tableName, id, rowData) => {
  const { data, error } = await supabase
    .from(tableName)
    .update(rowData)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
};

export const deleteRow = async (tableName, id) => {
  const { error } = await supabase.from(tableName).delete().eq("id", id);
  if (error) throw error;
  return id;
};
