import { createAsyncThunk } from "@reduxjs/toolkit";
import { supabase } from "@/lib/supabase";
import { toSnakeCase, toCamelCaseArray } from "@/lib/mapFields";

const TABLE = "act_activos";

export const fetchActivosFijosPaginated = createAsyncThunk(
  "activosFijos/fetchActivosFijosPaginated",
  async ({ page = 1, pageSize = 100, filters = {} } = {}, { rejectWithValue }) => {
    try {
      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;

      let query = supabase
        .from(TABLE)
        .select("*", { count: "exact" })
        .eq("ultimoregistro", 1)
        .eq("estadoinventario", "REVISADO")
        .order("codigoactivointerno", { ascending: true })
        .range(start, end);

      if (filters.search) {
        const s = filters.search.replace(/%/g, "").trim();
        if (s) {
          const searchNum = Number(s);
          if (!isNaN(searchNum)) {
            query = query.or(`codigoactivo.eq.${searchNum}`);
          } else {
            const words = s.split(/\s+/).filter(Boolean);
            words.forEach((word) => {
              query = query.or(`descripcionactivo.ilike.%${word}%,cirun.ilike.%${word}%`);
            });
          }
        }
      }

      if (filters.carnet) {
        const c = filters.carnet.replace(/%/g, "").trim();
        if (c) {
          const words = c.split(/\s+/).filter(Boolean);
          words.forEach((word) => {
            query = query.ilike("cirun", `%${word}%`);
          });
        }
      }

      if (filters.rubro && Array.isArray(filters.rubro)) {
        query = query.in("tiporubroact", filters.rubro.length > 0 ? filters.rubro : [-1]);
      }

      if (filters.ambiente) {
        query = query.eq("codigoambiente", filters.ambiente);
      }

      if (filters.nivel) {
        const { data: ambientesByNivel } = await supabase
          .from("act_ambiente")
          .select("codigoambiente")
          .eq("codigonivel", filters.nivel);
        const codes = (ambientesByNivel || []).map(a => a.codigoambiente);
        if (codes.length > 0) {
          query = query.in("codigoambiente", codes);
        } else {
          query = query.in("codigoambiente", [-1]);
        }
      }

      if (filters.inmueble) {
        const { data: nivelesByInmueble } = await supabase
          .from("act_nivel")
          .select("codigonivel")
          .eq("codigoinmueble", filters.inmueble);
        const nivelCodes = (nivelesByInmueble || []).map(n => n.codigonivel);
        if (nivelCodes.length > 0) {
          const { data: ambientesByNivel } = await supabase
            .from("act_ambiente")
            .select("codigoambiente")
            .in("codigonivel", nivelCodes);
          const codes = (ambientesByNivel || []).map(a => a.codigoambiente);
          if (codes.length > 0) {
            query = query.in("codigoambiente", codes);
          } else {
            query = query.in("codigoambiente", [-1]);
          }
        } else {
          query = query.in("codigoambiente", [-1]);
        }
      }

      if (filters.ciudad) {
        const { data: inmueblesByCiudad } = await supabase
          .from("act_inmueble")
          .select("codigoinmueble")
          .eq("codigociudad", filters.ciudad);
        const inmuebleCodes = (inmueblesByCiudad || []).map(i => i.codigoinmueble);
        let cityAmbientes = [];
        if (inmuebleCodes.length > 0) {
          const { data: nivelesByInmueble } = await supabase
            .from("act_nivel")
            .select("codigonivel")
            .in("codigoinmueble", inmuebleCodes);
          const nivelCodes = (nivelesByInmueble || []).map(n => n.codigonivel);
          if (nivelCodes.length > 0) {
            const { data: ambientesByNivel } = await supabase
              .from("act_ambiente")
              .select("codigoambiente")
              .in("codigonivel", nivelCodes);
            cityAmbientes = (ambientesByNivel || []).map(a => a.codigoambiente);
          }
        }
        if (cityAmbientes.length > 0) {
          query = query.in("codigoambiente", cityAmbientes);
        } else {
          query = query.in("codigoambiente", [-1]);
        }
      }

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        data: toCamelCaseArray(data || []),
        totalCount: count || 0,
        page,
        pageSize,
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const addActivoFijo = createAsyncThunk(
  "activosFijos/addActivoFijo",
  async (newActivoFijo, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .insert(toSnakeCase(newActivoFijo))
        .select("*")
        .single();
      if (error) throw error;
      return toCamelCaseArray([data])[0];
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateActivoFijo = createAsyncThunk(
  "activosFijos/updateActivoFijo",
  async ({ codigoActivoInterno, updatedActivoFijo }, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .update(toSnakeCase(updatedActivoFijo))
        .eq("codigoactivointerno", codigoActivoInterno)
        .select("*")
        .single();
      if (error) throw error;
      return toCamelCaseArray([data])[0];
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteActivoFijo = createAsyncThunk(
  "activosFijos/deleteActivoFijo",
  async (codigoActivoInterno, { rejectWithValue }) => {
    try {
      const { error } = await supabase.from(TABLE).delete().eq("codigoactivointerno", codigoActivoInterno);
      if (error) throw error;
      return codigoActivoInterno;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);
