import { supabase } from "@/lib/supabase";

const ROW_CHUNK = 1000;
const CODE_CHUNK = 500;

const chunkArray = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const fetchCodesInChunks = async (table, column, values, select, targetColumn) => {
  const batches = chunkArray(values, CODE_CHUNK);
  const results = await Promise.all(
    batches.map((batch) => supabase.from(table).select(select).in(column, batch)),
  );
  const rows = results.flatMap((r) => {
    if (r.error) throw r.error;
    return r.data || [];
  });
  return rows.map((r) => r[targetColumn]);
};

export const resolveAmbienteCodes = async ({ ciudad, inmueble, nivel, ambiente }) => {
  if (ambiente) {
    return [String(ambiente)];
  }

  if (nivel) {
    return fetchCodesInChunks("act_ambiente", "codigonivel", [nivel], "codigoambiente", "codigoambiente");
  }

  if (inmueble) {
    const nivelCodes = await fetchCodesInChunks("act_nivel", "codigoinmueble", [inmueble], "codigonivel", "codigonivel");
    if (nivelCodes.length === 0) return [];
    return fetchCodesInChunks("act_ambiente", "codigonivel", nivelCodes, "codigoambiente", "codigoambiente");
  }

  if (ciudad) {
    const inmuebleCodes = await fetchCodesInChunks("act_inmueble", "codigociudad", [ciudad], "codigoinmueble", "codigoinmueble");
    if (inmuebleCodes.length === 0) return [];
    const nivelCodes = await fetchCodesInChunks("act_nivel", "codigoinmueble", inmuebleCodes, "codigonivel", "codigonivel");
    if (nivelCodes.length === 0) return [];
    return fetchCodesInChunks("act_ambiente", "codigonivel", nivelCodes, "codigoambiente", "codigoambiente");
  }

  return [];
};

const fetchCirunsForCodes = async (codes) => {
  const allRows = [];
  let start = 0;
  let chunk;
  do {
    const { data, error } = await supabase
      .from("act_activos")
      .select("cirun")
      .eq("ultimoregistro", 1)
      .in("codigoambiente", codes)
      .order("cirun", { ascending: true })
      .range(start, start + ROW_CHUNK - 1);
    if (error) throw error;
    chunk = data || [];
    allRows.push(...chunk);
    start += ROW_CHUNK;
  } while (chunk.length === ROW_CHUNK);
  return allRows;
};

export const fetchMatchingCiruns = async ({ ciudad, inmueble, nivel, ambiente }) => {
  const codes = await resolveAmbienteCodes({ ciudad, inmueble, nivel, ambiente });
  if (codes.length === 0) return new Set();

  const batches = [];
  for (let i = 0; i < codes.length; i += CODE_CHUNK) {
    batches.push(codes.slice(i, i + CODE_CHUNK));
  }

  const results = await Promise.all(batches.map(fetchCirunsForCodes));

  const ciruns = new Set();
  results.flat().forEach((row) => {
    if (row.cirun != null && String(row.cirun).trim() !== "") {
      ciruns.add(String(row.cirun).trim());
    }
  });

  return ciruns;
};
