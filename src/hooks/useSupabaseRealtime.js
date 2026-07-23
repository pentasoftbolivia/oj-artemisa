import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { supabase } from '@/lib/supabase';
import { selectIsAuthenticated } from '@/store/auth/authSlice';

// Import all fetch thunks
import { fetchAmbientes } from '@/store/ambiente/ambienteThunks';
import { fetchCiudades } from '@/store/ciudad/ciudadThunks';
import { fetchInmuebles } from '@/store/inmueble/inmuebleThunks';
import { fetchNiveles } from '@/store/nivel/nivelThunks';
import { fetchRubros } from '@/store/rubro/rubroThunks';
import { fetchTipoRubros } from '@/store/tiporubro/tiporubroThunks';
import { fetchFuncionario } from '@/store/funcionario/funcionarioThunks';
import { fetchMovimientos } from '@/store/movimientos/movimientosThunks';
import { fetchAsignaciones } from '@/store/asignaciones/asignacionesThunks';

/**
 * Hook global para mantener sincronizada la interfaz con la base de datos.
 * Escucha los eventos INSERT, UPDATE, DELETE de las tablas públicas en Supabase
 * y despacha los thunks correspondientes de Redux para recargar los datos de manera agrupada (debounced).
 */
export const useSupabaseRealtime = () => {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const timeouts = useRef({});

  useEffect(() => {
    // Solo suscribirse si el usuario está autenticado
    if (!isAuthenticated) return;

    // Función de debouncing: Agrupa múltiples eventos rápidos de una misma tabla en un solo fetch
    const debouncedFetch = (table) => {
      if (timeouts.current[table]) {
        clearTimeout(timeouts.current[table]);
      }

      timeouts.current[table] = setTimeout(() => {
        // console.log(`[Realtime] Actualizando tabla: ${table}`);
        switch (table) {
          case 'act_ambiente':
            dispatch(fetchAmbientes());
            break;
          case 'act_ciudad':
            dispatch(fetchCiudades());
            break;
          case 'act_inmueble':
            dispatch(fetchInmuebles());
            break;
          case 'act_nivel':
            dispatch(fetchNiveles());
            break;
          case 'act_rubro':
            dispatch(fetchRubros());
            break;
          case 'act_tiporubro':
            dispatch(fetchTipoRubros());
            break;
          case 'funcionario':
            dispatch(fetchFuncionario());
            break;
          case 'act_activos':
            // No se recarga automáticamente para evitar descargas masivas.
            // El componente ActivosFijosList maneja su propia recarga paginada.
            break;
          case 'movimientos_cabecera':
          case 'movimientos_detalle':
            dispatch(fetchMovimientos());
            break;
          case 'asignaciones':
            dispatch(fetchAsignaciones());
            break;
          default:
            break; // Tablas no mapeadas o irrelevantes (ej. logs, users, etc.)
        }
      }, 1000); // 1 segundo de agrupación (debounce)
    };

    // Suscribirse a todos los eventos en el esquema público
    const channel = supabase.channel('global-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          debouncedFetch(payload.table);
        }
      )
      .subscribe(() => {
        // if (status === 'SUBSCRIBED') {
        //   console.log('[Realtime] Conectado exitosamente a Supabase WebSocket');
        // }
      });

    // Cleanup al desmontar el hook o cuando el usuario cierra sesión
    const currentTimeouts = timeouts.current;
    return () => {
      supabase.removeChannel(channel);
      Object.values(currentTimeouts).forEach(clearTimeout);
    };
  }, [dispatch, isAuthenticated]);
};
