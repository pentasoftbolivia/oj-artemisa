import { configureStore } from '@reduxjs/toolkit';

import { authSlice } from "./auth";
import funcionarioReducer from './funcionario/funcionarioSlice';
import ambienteReducer from './ambiente/ambienteSlice';
import ciudadReducer from './ciudad/ciudadSlice';
import inmuebleReducer from './inmueble/inmuebleSlice';
import nivelReducer from './nivel/nivelSlice';
import rubroReducer from './rubro/rubroSlice';
import tiporubroReducer from './tiporubro/tiporubroSlice';
import activosFijosReducer from './activosFijos/activosFijosSlice';
import asignacionesReducer from './asignaciones/asignacionesSlice';
import movimientosReducer from './movimientos/movimientosSlice';
export const store = configureStore({
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
  reducer: {
    auth: authSlice.reducer,
    funcionario: funcionarioReducer,
    ambiente: ambienteReducer,
    ciudad: ciudadReducer,
    inmueble: inmuebleReducer,
    nivel: nivelReducer,
    rubro: rubroReducer,
    tiporubro: tiporubroReducer,
    activosFijos: activosFijosReducer,
    asignaciones: asignacionesReducer,
    movimientos: movimientosReducer,
  },
});