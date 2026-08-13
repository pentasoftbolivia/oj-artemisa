import { createAsyncThunk } from "@reduxjs/toolkit";
import { supabase, fetchAllFromTable } from "@/lib/supabase";
import { toSnakeCase, toCamelCaseArray } from "@/lib/mapFields";
import { invalidateCatalog } from "@/lib/catalogCache";

const TABLE = "act_responsable";

const RESPONSABLE_SELECT =
  "cirun, codigoambiente, nombre1, nombre2, paterno, materno, estado, autoriza, cargo, login_sid, usuarioregistro, fecharegistro, registroactivo";

export const fetchResponsable = createAsyncThunk(
  "responsable/fetchResponsable",
  async (_, { rejectWithValue }) => {
    try {
      let allData = [];
      let start = 0;
      const CHUNK_SIZE = 1000;
      let chunk;
      do {
        const { data, error } = await supabase
          .from(TABLE)
          .select(RESPONSABLE_SELECT)
          .order("cirun", { ascending: true })
          .range(start, start + CHUNK_SIZE - 1);
        if (error) throw error;
        chunk = data || [];
        allData = allData.concat(chunk);
        start += CHUNK_SIZE;
      } while (chunk.length === CHUNK_SIZE);

      const responsables = toCamelCaseArray(allData);

      let actaRows = [];
      try {
        actaRows = await fetchAllFromTable(
          "act_responsable_acta",
          "cirun, numeroacta, codigoambiente",
          { orderColumn: "cirun", ascending: true },
        );
      } catch (actaError) {
        console.error("Error al cargar numeros de acta:", actaError);
      }

      const numeroActaByCirun = {};
      const actasByCirun = {};
      (actaRows || []).forEach((row) => {
        const ci = String(row.cirun ?? "").trim();
        const num = row.numeroacta != null ? String(row.numeroacta).trim() : "";
        const amb = row.codigoambiente != null ? String(row.codigoambiente) : "";
        if (ci && num !== "") {
          if (!(ci in actasByCirun)) actasByCirun[ci] = [];
          actasByCirun[ci].push({ codigoambiente: amb, numeroacta: num });
        }
      });

      Object.keys(actasByCirun).forEach((ci) => {
        const actas = actasByCirun[ci];
        const numeric = actas
          .map((a) => Number(a.numeroacta))
          .filter((n) => !Number.isNaN(n));
        if (numeric.length > 0) {
          numeroActaByCirun[ci] = String(Math.max(...numeric));
        } else {
          numeroActaByCirun[ci] = actas[actas.length - 1].numeroacta;
        }
      });

      responsables.forEach((r) => {
        const ci = String(r.cirun ?? "").trim();
        r.numeroacta = numeroActaByCirun[ci] ?? null;
        r.actas = actasByCirun[ci] ?? [];
      });

      return responsables;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const addResponsable = createAsyncThunk(
  "responsable/addResponsable",
  async (newResponsable, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .insert(toSnakeCase(newResponsable))
        .select("*")
        .single();
      if (error) throw error;
      invalidateCatalog(TABLE);
      return toCamelCaseArray([data])[0];
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateResponsable = createAsyncThunk(
  "responsable/updateResponsable",
  async ({ cirun, updatedResponsable }, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .update(toSnakeCase(updatedResponsable))
        .eq("cirun", cirun)
        .select("*")
        .single();
      if (error) throw error;
      invalidateCatalog(TABLE);
      return toCamelCaseArray([data])[0];
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteResponsable = createAsyncThunk(
  "responsable/deleteResponsable",
  async (cirun, { rejectWithValue }) => {
    try {
      const { error } = await supabase.from(TABLE).delete().eq("cirun", cirun);
      if (error) throw error;
      invalidateCatalog(TABLE);
      return cirun;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);
