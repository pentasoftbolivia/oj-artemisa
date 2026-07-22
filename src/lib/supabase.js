import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL or Anon Key missing in .env");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const CHUNK_SIZE = 1000;

export const fetchAllFromTable = async (table, select = "*", options = {}) => {
  const { orderColumn = "id", ascending = true, filters = {} } = options;
  let allData = [];
  let start = 0;
  let chunk;

  do {
    let query = supabase
      .from(table)
      .select(select)
      .order(orderColumn, { ascending })
      .range(start, start + CHUNK_SIZE - 1);

    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    const { data, error } = await query;
    if (error) throw error;
    chunk = data || [];
    allData = allData.concat(chunk);
    start += CHUNK_SIZE;
  } while (chunk.length === CHUNK_SIZE);

  return allData;
};
