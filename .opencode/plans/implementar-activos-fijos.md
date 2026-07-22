# Plan de Implementación: Componente activosFijos

## Convención de nombres
- Directorio: src/activosFijos/ (camelCase)
- Store: ctivosFijosSlice.js, ctivosFijosThunks.js
- Tabla BD: ctivos_fijos (snake_case) mapeada via mapFields.js

---

## Archivos a crear (7)

### 1. src/store/activosFijos/activosFijosThunks.js

`js
import { createAsyncThunk } from "@reduxjs/toolkit";
import { supabase } from "@/lib/supabase";
import { toSnakeCase, toCamelCaseArray } from "@/lib/mapFields";

const TABLE = "activos_fijos";

export const fetchActivosFijos = createAsyncThunk(
  "activosFijos/fetchActivosFijos",
  async (_, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase.from(TABLE).select("*");
      if (error) throw error;
      return toCamelCaseArray(data);
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
  async ({ id, updatedActivoFijo }, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .update(toSnakeCase(updatedActivoFijo))
        .eq("id", id)
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
  async (id, { rejectWithValue }) => {
    try {
      const { error } = await supabase.from(TABLE).delete().eq("id", id);
      if (error) throw error;
      return id;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);
`

## Archivos a modificar (3)

### 7. src/store/store.js — Agregar reducer

Agregar estas 2 lineas:

`js
import activosFijosReducer from './activosFijos/activosFijosSlice';
// y en el objeto reducer:
activosFijos: activosFijosReducer,
`

### 8. src/router/AppRouter.jsx — Agregar ruta

Agregar import y ruta (mismo patron que las otras rutas).

### 9. src/lib/mapFields.js — Agregar mapeos

Agregar al objeto FK_MAP los campos de activos_fijos.

---

## Resumen

| Accion | Archivo |
|--------|---------|
| Crear | src/store/activosFijos/activosFijosThunks.js |
| Crear | src/store/activosFijos/activosFijosSlice.js |
| Crear | src/activosFijos/ActivosFijosApp.jsx |
| Crear | src/activosFijos/routes/ActivosFijosRoutes.jsx |
| Crear | src/activosFijos/pages/ActivosFijosForm.jsx |
| Crear | src/activosFijos/pages/ActivosFijosList.jsx |
| Modificar | src/store/store.js — import + reducer |
| Modificar | src/router/AppRouter.jsx — import + ruta |
| Modificar | src/lib/mapFields.js — mapeos snake_case |

Navigation.js ya tiene la entrada "/activos" (sin cambios necesarios).
