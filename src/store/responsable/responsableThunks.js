import { createAsyncThunk } from "@reduxjs/toolkit";
import { fetchAllFromTable } from "@/lib/supabase";
import { toCamelCaseArray } from "@/lib/mapFields";
import { createCrudThunks } from "@/store/generic/createCrudThunks";

const TABLE = "act_responsable";

const RESPONSABLE_SELECT =
  "cirun, codigoambiente, nombre1, nombre2, paterno, materno, estado, autoriza, cargo, login_sid, usuarioregistro, fecharegistro, registroactivo";

export const fetchResponsable = createAsyncThunk(
  "responsable/fetchResponsable",
  async (_, { rejectWithValue }) => {
    try {
      const rows = await fetchAllFromTable(TABLE, RESPONSABLE_SELECT, {
        orderColumn: "cirun",
        ascending: true,
      });

      const responsables = toCamelCaseArray(rows);

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

const crud = createCrudThunks({
  prefix: "responsable",
  table: TABLE,
  idColumn: "cirun",
  updatedKey: "updatedResponsable",
});

export const addResponsable = crud.add;
export const updateResponsable = crud.update;
export const deleteResponsable = crud.remove;
