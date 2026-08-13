import { supabase } from "@/lib/supabase";
import { invalidateCatalog } from "@/lib/catalogCache";

const findRow = async (table, filters, options = {}) => {
  let query = supabase.from(table).select("*");
  Object.entries(filters).forEach(([column, value]) => {
    query = query.eq(column, value);
  });
  if (options.order) query = query.order(options.order.column, { ascending: options.order.ascending });
  const { data, error } = await query.limit(1);
  if (error) throw error;
  return data && data[0] ? data[0] : null;
};

const updateRow = async (table, idColumn, idValue, payload) => {
  const { data, error } = await supabase
    .from(table)
    .update(payload)
    .eq(idColumn, idValue)
    .select("*")
    .single();
  if (error) throw error;
  invalidateCatalog(table);
  return data;
};

export const findActivo = async (query) => {
  const num = Number(String(query || "").replace(/\D/g, ""));
  if (!num) return null;
  return findRow("act_activos", { codigoactivo: num, ultimoregistro: 1 });
};

export const updateActivo = (row, payload) =>
  updateRow("act_activos", "codigoactivointerno", row.codigoactivointerno, payload);

export const findResponsable = async (query) => {
  const carnet = String(query || "").trim();
  if (!carnet) return null;
  return findRow("act_responsable", { cirun: carnet });
};

export const updateResponsable = (row, payload) =>
  updateRow("act_responsable", "cirun", row.cirun, payload);

export const findAmbiente = async (query) => {
  const codigo = String(query || "").trim();
  if (!codigo) return null;
  return findRow("act_ambiente", { codigoambiente: codigo });
};

export const updateAmbiente = (row, payload) =>
  updateRow("act_ambiente", "codigoambiente", row.codigoambiente, payload);

export const findTransferencia = async (query) => {
  const num = Number(String(query || "").replace(/\D/g, ""));
  if (!num) return null;
  return findRow("act_transferencias", { codigotransaccion: num });
};

export const updateTransferencia = (row, payload) =>
  updateRow("act_transferencias", "codigotransaccion", row.codigotransaccion, payload);