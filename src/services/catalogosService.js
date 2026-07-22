import { supabase } from "@/lib/supabase";

const CHUNK_SIZE = 1000;

/**
 * Fetch a specific dictionary/catalogue table.
 * @param {string} tableName - The name of the table to fetch.
 * @param {string} columns - The columns to select, defaults to "id, nombre".
 * @returns {Promise<Array>} The fetched data.
 */
export const getCatalogo = async (tableName, columns = "id, nombre") => {
  let allData = [];
  let start = 0;
  let chunk;

  do {
    const { data, error } = await supabase
      .from(tableName)
      .select(columns)
      .order("id")
      .range(start, start + CHUNK_SIZE - 1);

    if (error) throw error;

    chunk = data || [];
    allData = allData.concat(chunk);
    start += CHUNK_SIZE;
  } while (chunk.length === CHUNK_SIZE);

  return allData;
};

/**
 * Fetch multiple catalogues concurrently.
 * @param {Array<{table: string, columns?: string}>} catalogos - List of catalogues to fetch.
 * @returns {Promise<Object>} An object containing the data mapped by table name.
 */
export const getCatalogos = async (catalogos) => {
  const results = await Promise.all(
    catalogos.map((cat) => getCatalogo(cat.table, cat.columns))
  );

  const mappedResults = {};
  catalogos.forEach((cat, index) => {
    mappedResults[cat.table] = results[index];
  });

  return mappedResults;
};
