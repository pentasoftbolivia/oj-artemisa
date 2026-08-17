import { supabase } from "@/lib/supabase";

const CABECERA_TABLE = "movimientos_cabecera";
const CHUNK_SIZE = 1000;

export const getAllMovimientos = async () => {
  let allData = [];
  let start = 0;
  let chunk;
  do {
    const { data, error } = await supabase
      .from(CABECERA_TABLE)
      .select("*, movimientos_detalle:movimientos_detalle(count)")
      .order("id", { ascending: true })
      .range(start, start + CHUNK_SIZE - 1);
    if (error) throw error;
    chunk = data || [];
    allData = allData.concat(chunk);
    start += CHUNK_SIZE;
  } while (chunk.length === CHUNK_SIZE);
  return allData;
};