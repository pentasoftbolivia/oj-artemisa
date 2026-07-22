# Standardization and Code Cleanup

The codebase has been successfully cleaned and standardized as requested.

## 1. ESLint Issues Resolved

All ESLint issues reported in the previous run have been fixed:
- **`ActivosFijosForm.jsx` & `FuncionariosForm.jsx`**: Removed unused `hasErrors` variables.
- **`ActivosFijosList.jsx`**: Removed unused `useRef` for barcode and QR canvases; added missing `getTipoActivoName` dependencies in hooks.
- **`AsignacionesList.jsx`**: Added the missing `toast` dependency to the `useEffect` hook.
- **`FuncionariosList.jsx`**: Removed the unused `getEntidadName` and `entidadesMap` variables, as well as the unused `entidades` state variables.
- **`movimientosThunks.js`**: Removed the duplicated and unused `fetchAllRows` function.

A final check using `npm run lint` confirms there are **0 errors and 0 warnings**.

## 2. Field Mapping Standardization

We have successfully standardized the Redux Thunks for all remaining CRUD modules (`asignaciones`, `cargos`, `entidades`, `unidades`) to use `toSnakeCase()` and `toCamelCaseArray()`. This aligns the entire project with the clean architecture conventions set in `src/lib/mapFields.js`.

- Updated `FK_MAP` in `src/lib/mapFields.js` to include the additional fields for these modules (e.g., `tipoEntidad`, `funcionarioId`, `activoId`, `fechaAsignacion`, `ubicacionId`, etc.).
- Wrapped inserts/updates in `toSnakeCase(data)` and fetches in `toCamelCaseArray(data)` inside `asignacionesThunks.js`, `cargosThunks.js`, `entidadesThunks.js`, and `unidadesThunks.js`.
- Refactored `AsignacionesList.jsx` and `AsignacionesForm.jsx` to consume standard `camelCase` object properties instead of the `raw` snake_case database rows they previously handled. 

The standardization is now complete and all modules follow the project's data flow convention.
