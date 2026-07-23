import { configureStore } from '@reduxjs/toolkit';

import { authSlice } from "./auth";
import ambienteReducer from './ambiente/ambienteSlice';
import ciudadReducer from './ciudad/ciudadSlice';
import inmuebleReducer from './inmueble/inmuebleSlice';
import nivelReducer from './nivel/nivelSlice';
import rubroReducer from './rubro/rubroSlice';
import tiporubroReducer from './tiporubro/tiporubroSlice';
import activosFijosReducer from './activosFijos/activosFijosSlice';
import asignacionesReducer from './asignaciones/asignacionesSlice';
import movimientosReducer from './movimientos/movimientosSlice';
import responsableReducer from './responsable/responsableSlice';
export const store = configureStore({
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
  reducer: {
    auth: authSlice.reducer,
    ambiente: ambienteReducer,
    ciudad: ciudadReducer,
    inmueble: inmuebleReducer,
    nivel: nivelReducer,
    rubro: rubroReducer,
    tiporubro: tiporubroReducer,
    activosFijos: activosFijosReducer,
    asignaciones: asignacionesReducer,
    movimientos: movimientosReducer,
    responsable: responsableReducer,
  },
});