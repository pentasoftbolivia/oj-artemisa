import { supabase, fetchAllFromTable } from "@/lib/supabase";

const DEFAULT_TTL = 10 * 60 * 1000;

const CACHE = new Map();

const selectOrdered = async (table, columns, orderColumn, ascending = true) => {
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .order(orderColumn, { ascending });
  if (error) throw error;
  return data || [];
};

const TABLES = {
  act_rubro: {
    fetch: () => selectOrdered("act_rubro", "codigorubroact, descripcionrubroact", "descripcionrubroact", true),
  },
  act_tiporubro: {
    fetch: () => selectOrdered("act_tiporubro", "tiporubroact, descripciontiporubroact, codigorubroact", "descripciontiporubroact", true),
  },
  act_ambiente: {
    fetch: () => fetchAllFromTable("act_ambiente", "codigoambiente, ambiente, codigonivel", { orderColumn: "ambiente", ascending: true }),
  },
  act_responsable: {
    fetch: () => fetchAllFromTable("act_responsable", "cirun, nombre1, nombre2, paterno, materno, cargo, registroactivo", { orderColumn: "cirun", ascending: true }),
  },
  act_inmueble: {
    fetch: () => selectOrdered("act_inmueble", "codigoinmueble, inmueble, codigociudad", "inmueble", true),
  },
  act_nivel: {
    fetch: () => selectOrdered("act_nivel", "codigonivel, nivel, codigoinmueble", "nivel", true),
  },
  act_ciudad: {
    fetch: () => selectOrdered("act_ciudad", "codigociudad, descripcion", "descripcion", true),
  },
};

const resolve = async (fetcher) => {
  const res = await fetcher();
  if (res && res.data !== undefined) {
    if (res.error) throw res.error;
    return res.data || [];
  }
  return res || [];
};

export const getCachedCatalog = (table, { ttl = DEFAULT_TTL } = {}) => {
  const config = TABLES[table];
  if (!config) {
    throw new Error(`Catálogo no configurado en caché: ${table}`);
  }

  const now = Date.now();
  const entry = CACHE.get(table);
  if (entry) {
    if (entry.promise) return entry.promise;
    if (entry.expiresAt > now) return Promise.resolve(entry.data);
  }

  const promise = resolve(config.fetch)
    .then((data) => {
      CACHE.set(table, { data, expiresAt: Date.now() + ttl, promise: null });
      return data;
    })
    .catch((err) => {
      CACHE.delete(table);
      throw err;
    });

  CACHE.set(table, { promise, expiresAt: now + ttl, data: null });
  return promise;
};

export const invalidateCatalog = (table) => {
  CACHE.delete(table);
};
