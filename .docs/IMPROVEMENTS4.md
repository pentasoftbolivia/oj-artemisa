# Implementación de Supabase Realtime - Walkthrough

## 🎯 Logros

He implementado un sistema global de sincronización en tiempo real para toda la aplicación usando WebSockets de Supabase, manteniendo la arquitectura limpia y aprovechando Redux.

## ⚙️ Cómo Funciona

1. **Nuevo Hook Global (`useSupabaseRealtime.js`)**: 
   - Se encarga de escuchar todos los eventos `INSERT`, `UPDATE` y `DELETE` de la base de datos (esquema `public`).
   - Solo se activa cuando el usuario está autenticado (`isAuthenticated === true`).
   - Al recibir un cambio de una tabla (ej. alguien agregó un nuevo activo fijo), el hook despacha automáticamente el thunk correspondiente de Redux (ej. `fetchActivosFijos()`) para refrescar la lista.

2. **Optimización con Debouncing**:
   - Para evitar que la aplicación colapse si se insertan múltiples registros a la vez, se implementó un mecanismo de *debounce* de 1 segundo agrupado por tabla. Si llegan 50 notificaciones de cambios en la tabla `activos_fijos` en menos de 1 segundo, solo se disparará **una sola** petición al backend.

3. **Integración Transparente**:
   - El hook fue inyectado directamente en el componente raíz de navegación (`AppRouter.jsx`).
   - Esto significa que el desarrollador no necesita agregar llamadas a WebSockets en cada pantalla por separado. Cualquier pantalla nueva heredará automáticamente la capacidad de actualizarse en tiempo real si el usuario está en sesión.

> [!TIP]
> **Pruébalo tú mismo:** Abre la aplicación en una pestaña normal y en otra pestaña de incógnito (o en dos navegadores distintos). Haz un cambio (edita el nombre de un funcionario o agrega un país) en la Pestaña A. Verás que la Pestaña B actualiza la tabla por sí sola en cuestión de un par de segundos, sin necesidad de presionar el botón de recargar.
