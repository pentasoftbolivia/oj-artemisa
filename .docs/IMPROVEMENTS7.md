# Refactorización Completada: Limpieza de Código y Fix de Caché

He aplicado las correcciones exactas solicitadas sin alterar en absoluto la funcionalidad y la estructura visual o de componentes de la aplicación.

## Cambios Realizados

### 1. Aplicación del Principio DRY (Diccionarios de Catálogos)
- Se creó una función utilitaria global genérica `createLookupMap` en `src/lib/utils.js`.
- Se reemplazó la lógica manual `array.reduce(...)` que se repetía visualmente **10 veces** a través de [MovimientosList.jsx](file:///c:/Users/CASTELLON/2026/dev/reactjs/oj-inventario-revaluo/web-activos-fijos/src/movimientos/pages/MovimientosList.jsx) y [MovimientosForm.jsx](file:///c:/Users/CASTELLON/2026/dev/reactjs/oj-inventario-revaluo/web-activos-fijos/src/movimientos/pages/MovimientosForm.jsx).
- Esto redujo el peso visual y mejoró la legibilidad de forma drástica.

### 2. Reparación del Bug de Caché de Redux
- Se importó el hook `useStore` nativo de `react-redux` en `MovimientosList.jsx`.
- En lugar de engañar al selector `selectDetallesByMovimientoId` con un objeto falso (`{ movimientos: { detallesPorMovimiento: {} } }`), ahora la función `openDetalleModal` utiliza limpiamente `store.getState()` para obtener el estado síncrono real y verificar si los detalles del movimiento en particular ya han sido descargados.
- **Resultado:** El modal de detalles ahora usa memoria caché de verdad; la segunda vez que abras un mismo movimiento cargará instantáneamente sin gastar red.

### 3. Resolución de Advertencias de ESLint
- Se limpió el array de dependencias del método `handleFormSubmit` en `MovimientosList.jsx`, removiendo la dependencia innecesaria (`fetchMovimientos`).
- La ejecución posterior de `npm run lint` confirmó que el componente de Movimientos ahora está 100% libre de advertencias y errores.

> [!TIP]
> Todos estos cambios mantienen las mismas reglas de negocio y funcionalidad que ya existían previamente.
