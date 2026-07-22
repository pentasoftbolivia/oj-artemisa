# OJ Activos Fijos - Documentación del Sistema

## Visión General

Sistema de gestión de activos fijos para el **Órgano Judicial - La Paz**.
Administra el ciclo de vida completo de activos fijos: registro, clasificación
por tipo, asignación a funcionarios, movimientos entre ubicaciones y revalorización.

## Stack Técnico

| Capa     | Tecnología                                     |
| -------- | ---------------------------------------------- |
| Frontend | React 18 + Vite 7 + Tailwind CSS 3 + shadcn/ui |
| Estado   | Redux Toolkit (13 slices)                      |
| Backend  | Supabase (Auth + PostgreSQL REST API)          |
| Íconos   | Lucide React                                   |
| Auth     | Supabase Authentication + tabla `users`        |

## Estructura del Proyecto

```
src/
├── auth/                   # Autenticación (activosfijos, OAuth callback)
├── config/                 # Navegación (menú)
├── constants/              # Constantes (tipos de reporte)
├── components/             # Componentes compartidos
│   ├── navbar/             # Barra de navegación
│   └── ui/                 # shadcn/ui (badge, button, dialog, table, etc.)
├── hooks/                  # Hooks globales
├── lib/                    # Utilidades (supabase client, auth helpers, field mapping, PDF)
├── router/                 # AppRouter, PrivateRoute, PublicRoute
├── store/                  # Redux store + slices + thunks
│   ├── store.js            # configureStore con 13 reducers
│   ├── auth/
│   ├── activosFijos/
│   ├── asignaciones/
│   ├── cargos/
│   ├── departamentos/
│   ├── entidades/
│   ├── funcionarios/
│   ├── movimientos/
│   ├── municipios/
│   ├── paises/
│   ├── provincias/
│   ├── ubicaciones/
│   └── unidades/
└── modules/                # Módulos funcionales (misma estructura)
    ├── activosFijos/       # Activos Fijos
    ├── asignaciones/       # Asignaciones
    ├── cargos/             # Cargos
    ├── departamentos/      # Departamentos
    ├── entidades/          # Entidades
    ├── funcionarios/       # Funcionarios
    ├── movimientos/        # Movimientos
    ├── municipios/         # Municipios
    ├── paises/             # Países
    ├── provincias/         # Provincias
    ├── ubicaciones/        # Ubicaciones
    └── unidades/           # Unidades
```

Cada módulo CRUD sigue el mismo patrón:

```
ModuleName/
  ModuleNameApp.jsx              → Renderiza la lista
  routes/ModuleNameRoutes.jsx    → Ruta anidada bajo /modulo/*
  pages/
    ModuleNameList.jsx           → Tabla + filtros + paginación + dialogo CRUD
    ModuleNameForm.jsx           → Formulario de creación/edición
```

Cada slice en store sigue:

```
store/moduleName/
  moduleNameSlice.js             → createSlice + selectors
  moduleNameThunks.js            → createAsyncThunk (fetchAll, add, update, delete)
```

### Helper de Fetch por Lotes

Todos los thunks que listan registros usan `fetchAllRows(table)` que obtiene datos
de Supabase en fragmentos de 1000 filas para manejar grandes volúmenes.

### Mapeo de Campos

La mayoría de los módulos usan `toSnakeCase()` y `toCamelCaseArray()` de
`src/lib/mapFields.js` para convertir entre camelCase (JS) y snake_case (PostgreSQL).
Excepciones: `asignaciones`, `cargos`, `entidades`, `unidades` (pasan objetos raw).

---

## 1. Autenticación (`/auth/*`)

### Páginas

| Ruta                 | Componente     | Descripción                                      |
| -------------------- | -------------- | ------------------------------------------------ |
| `/auth/activosfijos` | `LoginPage`    | Formulario email/password + Google SSO           |
| `/auth/callback`     | `AuthCallback` | Procesa callback OAuth, redirige a ruta anterior |

### Slice (`store/auth/authSlice.js`)

```js
state: {
  status: ("checking" | "authenticated" | "not-authenticated",
    uid,
    email,
    displayName,
    photoURL,
    role,
    errorMessage);
}
```

| Selector                | Retorna                       |
| ----------------------- | ----------------------------- |
| `selectUser`            | Datos del usuario autenticado |
| `selectUserRole`        | Rol del usuario               |
| `selectIsAuthenticated` | `true`/`false`                |
| `selectAuthStatus`      | Estado de autenticación       |

| Thunk                         | Acción                       |
| ----------------------------- | ---------------------------- |
| `startLoginWithEmailPassword` | Login con email y contraseña |
| `startGoogleSignIn`           | Login con Google SSO         |

### Hook `useCheckAuth.js`

Se suscribe a `supabase.auth.onAuthStateChange`. En `INITIAL_SESSION` o `SIGNED_IN`
hace upsert del usuario en la tabla `users` y despacha `activosfijos()`. En `SIGNED_OUT`
despacha `logout()`.

---

## 2. Países (`/paises/*`) — Tabla: `paises`

### Campos del Formulario

| Campo        | Tipo | Descripción             |
| ------------ | ---- | ----------------------- |
| nombre       | text | Nombre del país         |
| nacionalidad | text | Gentilicio              |
| codigo_iso   | text | Código ISO (ej: BO, AR) |

### Listado

| Columna      | Display                |
| ------------ | ---------------------- |
| ID           | `id`                   |
| Nombre       | `nombre`               |
| Nacionalidad | `nacionalidad`         |
| Código ISO   | Badge con `codigo_iso` |
| Acciones     | Editar, Eliminar       |

### Store

| Selector              | Thunks                     |
| --------------------- | -------------------------- |
| `selectPaises`        | `fetchPaises`, `addPais`   |
| `selectPaisesLoading` | `updatePais`, `deletePais` |
| `selectPaisesError`   |                            |

---

## 3. Departamentos (`/departamentos/*`) — Tabla: `departamentos`

### Campos del Formulario

| Campo   | Tipo         | Descripción             |
| ------- | ------------ | ----------------------- |
| nombre  | text         | Nombre del departamento |
| pais_id | integer (FK) | FK → `paises.id`        |

### Listado

| Columna  | Display                   |
| -------- | ------------------------- |
| ID       | `id`                      |
| Nombre   | `nombre`                  |
| País     | Badge con nombre del país |
| Acciones | Editar, Eliminar          |

### Store

| Selector                     | Thunks                                     |
| ---------------------------- | ------------------------------------------ |
| `selectDepartamentos`        | `fetchDepartamentos`, `addDepartamento`    |
| `selectDepartamentosLoading` | `updateDepartamento`, `deleteDepartamento` |
| `selectDepartamentosError`   |                                            |

---

## 4. Provincias (`/provincias/*`) — Tabla: `provincias`

### Campos del Formulario

| Campo           | Tipo         | Descripción             |
| --------------- | ------------ | ----------------------- |
| nombre          | text         | Nombre de la provincia  |
| departamento_id | integer (FK) | FK → `departamentos.id` |

### Listado

| Columna      | Display                 |
| ------------ | ----------------------- |
| ID           | `id`                    |
| Nombre       | `nombre`                |
| Departamento | Nombre del departamento |
| Acciones     | Editar, Eliminar        |

### Store

| Selector                  | Thunks                               |
| ------------------------- | ------------------------------------ |
| `selectProvincias`        | `fetchProvincias`, `addProvincia`    |
| `selectProvinciasLoading` | `updateProvincia`, `deleteProvincia` |
| `selectProvinciasError`   |                                      |

---

## 5. Municipios (`/municipios/*`) — Tabla: `municipios`

### Campos del Formulario

| Campo        | Tipo         | Descripción          |
| ------------ | ------------ | -------------------- |
| nombre       | text         | Nombre del municipio |
| provincia_id | integer (FK) | FK → `provincias.id` |

### Listado

| Columna   | Display                |
| --------- | ---------------------- |
| ID        | `id`                   |
| Nombre    | `nombre`               |
| Provincia | Nombre de la provincia |
| Acciones  | Editar, Eliminar       |

### Store

| Selector                  | Thunks                               |
| ------------------------- | ------------------------------------ |
| `selectMunicipios`        | `fetchMunicipios`, `addMunicipio`    |
| `selectMunicipiosLoading` | `updateMunicipio`, `deleteMunicipio` |
| `selectMunicipiosError`   |                                      |

---

## 6. Ubicaciones (`/ubicaciones/*`) — Tabla: `ubicaciones`

### Campos del Formulario

| Campo        | Tipo         | Descripción              |
| ------------ | ------------ | ------------------------ |
| nombre       | text         | Nombre de la ubicación   |
| municipio_id | integer (FK) | FK → `municipios.id`     |
| estado       | text         | Estado (activo/inactivo) |

### Listado

| Columna   | Display                 |
| --------- | ----------------------- |
| ID        | `id`                    |
| Nombre    | `nombre`                |
| Municipio | Nombre del municipio    |
| Estado    | Badge (activo/inactivo) |
| Acciones  | Editar, Eliminar        |

### Store

| Selector                   | Thunks                               |
| -------------------------- | ------------------------------------ |
| `selectUbicaciones`        | `fetchUbicaciones`, `addUbicacion`   |
| `selectUbicacionesLoading` | `updateUbicacion`, `deleteUbicacion` |
| `selectUbicacionesError`   |                                      |

---

## 7. Entidades (`/entidades/*`) — Tabla: `entidades`

### Campos del Formulario

| Campo        | Tipo | Descripción                    |
| ------------ | ---- | ------------------------------ |
| nombre       | text | Nombre de la entidad           |
| tipo_entidad | text | Tipo (ej: Municipal, Nacional) |
| estado       | text | Estado (activo/inactivo)       |

### Listado

| Columna      | Display                  |
| ------------ | ------------------------ |
| ID           | `id`                     |
| Nombre       | `nombre`                 |
| Tipo Entidad | Badge con `tipo_entidad` |
| Estado       | Badge (activo/inactivo)  |
| Acciones     | Editar, Eliminar         |

### Store

| Selector                 | Thunks                           |
| ------------------------ | -------------------------------- |
| `selectEntidades`        | `fetchEntidades`, `addEntidad`   |
| `selectEntidadesLoading` | `updateEntidad`, `deleteEntidad` |
| `selectEntidadesError`   |                                  |

---

## 8. Unidades (`/unidades/*`) — Tabla: `unidades`

### Campos del Formulario

| Campo       | Tipo | Descripción                |
| ----------- | ---- | -------------------------- |
| nombre      | text | Nombre de la unidad        |
| abreviatura | text | Abreviatura (ej: kg, m, l) |

### Listado

| Columna     | Display          |
| ----------- | ---------------- |
| ID          | `id`             |
| Nombre      | `nombre`         |
| Abreviatura | `abreviatura`    |
| Acciones    | Editar, Eliminar |

### Store

| Selector                | Thunks                         |
| ----------------------- | ------------------------------ |
| `selectUnidades`        | `fetchUnidades`, `addUnidad`   |
| `selectUnidadesLoading` | `updateUnidad`, `deleteUnidad` |
| `selectUnidadesError`   |                                |

---

## 9. Cargos (`/cargos/*`) — Tabla: `cargos`

### Campos del Formulario

| Campo       | Tipo | Descripción           |
| ----------- | ---- | --------------------- |
| nombre      | text | Nombre del cargo      |
| descripcion | text | Descripción del cargo |

### Listado

| Columna     | Display          |
| ----------- | ---------------- |
| ID          | `id`             |
| Nombre      | `nombre`         |
| Descripción | `descripcion`    |
| Acciones    | Editar, Eliminar |

### Store

| Selector              | Thunks                       |
| --------------------- | ---------------------------- |
| `selectCargos`        | `fetchCargos`, `addCargo`    |
| `selectCargosLoading` | `updateCargo`, `deleteCargo` |
| `selectCargosError`   |                              |

---

## 10. Funcionarios (`/funcionarios/*`) — Tabla: `funcionarios`

### Campos del Formulario

| Campo            | Tipo         | Descripción              |
| ---------------- | ------------ | ------------------------ |
| nombres          | text         | Nombres                  |
| apellido_paterno | text         | Apellido paterno         |
| apellido_materno | text         | Apellido materno         |
| ci               | text         | Cédula de identidad      |
| cargo_id         | integer (FK) | FK → `cargos.id`         |
| entidad_id       | integer (FK) | FK → `entidades.id`      |
| ubicacion_id     | integer (FK) | FK → `ubicaciones.id`    |
| telefono         | text         | Teléfono/celular         |
| email            | text         | Correo electrónico       |
| estado           | text         | Estado (activo/inactivo) |

### Listado

| Columna         | Display                                         |
| --------------- | ----------------------------------------------- |
| ID              | `id`                                            |
| Nombre Completo | `nombres + apellido_paterno + apellido_materno` |
| CI              | `ci`                                            |
| Cargo           | Nombre del cargo                                |
| Entidad         | Nombre de la entidad                            |
| Ubicación       | Nombre de la ubicación                          |
| Teléfono        | `telefono`                                      |
| Email           | `email`                                         |
| Estado          | Badge (activo/inactivo)                         |
| Acciones        | Editar, Eliminar                                |

### Store

| Selector                    | Thunks                                   |
| --------------------------- | ---------------------------------------- |
| `selectFuncionarios`        | `fetchFuncionarios`, `addFuncionario`    |
| `selectSortedFuncionarios`  | `updateFuncionario`, `deleteFuncionario` |
| `selectFuncionarioById`     |                                          |
| `selectFuncionariosLoading` |                                          |
| `selectFuncionariosError`   |                                          |

---

## 11. Activos Fijos (`/activos/*`) — Tabla: `activos_fijos`

Módulo más complejo con ~60 campos. Es el catálogo maestro de activos.

### Campos del Formulario

| Campo                     | Tipo         | Descripción                            |
| ------------------------- | ------------ | -------------------------------------- |
| codigo_patrimonial        | text         | Código único del activo                |
| denominacion              | text         | Nombre/descripción del activo          |
| marca                     | text         | Marca                                  |
| modelo                    | text         | Modelo                                 |
| numero_serie              | text         | Número de serie                        |
| color                     | text         | Color                                  |
| dimensiones               | text         | Dimensiones                            |
| material                  | text         | Material de construcción               |
| tipo_activo_id            | integer (FK) | FK → `tipos_activo.id`                 |
| unidad_id                 | integer (FK) | FK → `unidades.id`                     |
| municipio_id              | integer (FK) | FK → `municipios.id`                   |
| ubicacion_actual_id       | integer (FK) | FK → `ubicaciones.id`                  |
| entidad_id                | integer (FK) | FK → `entidades.id`                    |
| estado_activo_id          | integer (FK) | FK → `estados_activo.id`               |
| valor_adquisicion         | numeric      | Valor de compra                        |
| fecha_adquisicion         | date         | Fecha de compra                        |
| fecha_ingreso             | date         | Fecha de ingreso al inventario         |
| vida_util                 | integer      | Años de vida útil                      |
| valor_residual            | numeric      | Valor residual                         |
| depreciacion_acumulada    | numeric      | Depreciación acumulada                 |
| fecha_ultima_depreciacion | date         | Fecha de última depreciación           |
| factor_actualizacion      | numeric      | Factor de actualización/revalorización |
| observaciones             | text         | Notas adicionales                      |

### Listado

| Columna            | Display                     |
| ------------------ | --------------------------- |
| ID                 | `id`                        |
| Código Patrimonial | `codigo_patrimonial`        |
| Denominación       | `denominacion`              |
| Marca              | `marca`                     |
| N° Serie           | `numero_serie`              |
| Tipo Activo        | Nombre del tipo             |
| Municipio          | Nombre del municipio        |
| Ubicación          | Nombre de la ubicación      |
| Estado             | Badge con nombre del estado |
| Acciones           | Editar, Eliminar            |

### Store

| Selector                    | Thunks                                 |
| --------------------------- | -------------------------------------- |
| `selectActivosFijos`        | `fetchActivosFijos`, `addActivoFijo`   |
| `selectSortedActivosFijos`  | `updateActivoFijo`, `deleteActivoFijo` |
| `selectActivoFijoById`      |                                        |
| `selectActivosFijosLoading` |                                        |
| `selectActivosFijosError`   |                                        |

---

## 12. Movimientos (`/movimientos/*`) — Tablas: `movimientos_cabecera`, `movimientos_detalle`

Módulo que gestiona traslados, asignaciones y reasignaciones de activos entre
funcionarios y ubicaciones, con trazabilidad mediante actas y resoluciones.

### Estados del Movimiento

| Estado    | Color Badge | Descripción                    |
| --------- | ----------- | ------------------------------ |
| BORRADOR  | secondary   | En edición, no finalizado      |
| ASIGNADO  | default     | Asignado, pendiente de aprobar |
| APROBADO  | success     | Aprobado y cerrado             |
| RECHAZADO | destructive | Rechazado                      |

### Campos de Cabecera (`movimientos_cabecera`)

| Campo                    | Tipo         | Descripción                             |
| ------------------------ | ------------ | --------------------------------------- |
| `id`                     | integer (PK) | Identificador único                     |
| `entidad_id`             | integer      | Entidad (fijo: 1)                       |
| `tipo_movimiento_id`     | integer (FK) | FK → `tipos_movimiento.id`              |
| `fecha_movimiento`       | date         | Fecha del movimiento                    |
| `fecha_aprobacion`       | date         | Fecha de aprobación (opcional)          |
| `numero_acta`            | text         | Número de acta (opcional)               |
| `numero_resolucion`      | text         | Número de resolución (opcional)         |
| `funcionario_origen_id`  | integer (FK) | FK → `funcionarios.id` (opcional)       |
| `funcionario_destino_id` | integer (FK) | FK → `funcionarios.id`                  |
| `ubicacion_origen_id`    | integer (FK) | FK → `ubicaciones.id` (opcional)        |
| `ubicacion_destino_id`   | integer (FK) | FK → `ubicaciones.id` (opcional)        |
| `estado_movimiento`      | text         | BORRADOR, ASIGNADO, APROBADO, RECHAZADO |
| `aprobado_por_id`        | integer (FK) | FK → `funcionarios.id` (opcional)       |
| `motivo`                 | text         | Motivo del movimiento                   |
| `observaciones`          | text         | Observaciones                           |

### Campos de Detalle (`movimientos_detalle`)

| Campo                    | Tipo         | Descripción                                  |
| ------------------------ | ------------ | -------------------------------------------- |
| `id`                     | integer (PK) | Identificador único                          |
| `movimiento_id`          | integer (FK) | FK → `movimientos_cabecera.id` (CASCADE DEL) |
| `activo_id`              | integer (FK) | FK → `activos_fijos.id`                      |
| `numero_linea`           | integer      | Número de línea dentro del movimiento        |
| `estado_activo_anterior` | integer (FK) | FK → `estados_activo.id`                     |
| `estado_activo_nuevo`    | integer (FK) | FK → `estados_activo.id`                     |
| `condicion_anterior`     | text         | Condición previa                             |
| `condicion_nueva`        | text         | Condición posterior                          |
| `observaciones`          | text         | Observaciones del detalle                    |

### Funcionalidades Implementadas

1. **Listado** con filtros por texto, tipo de movimiento y estado. Paginación
   (50 por página). Cada fila muestra el conteo de activos en el botón
   `Detalles (N)` obtenido mediante subconsulta `movimientos_detalle(count)`.

2. **Crear**: formulario de cabecera + sección de detalle donde se agregan
   activos uno por uno con estado anterior/nuevo y condición.

3. **Editar**: carga cabecera y detalles existentes. Cada detalle tiene botones
   de **Editar** (carga datos al formulario superior, cambia botón a
   "Guardar Edición" + "Cancelar") y **Eliminar**.

4. **Ver Detalles**: modal de solo lectura con tabla de activos del movimiento.

5. **Eliminar**: confirmación, borra en cascada (detalles → cabecera).

### Store (`store/movimientos/`)

```js
state: {
  data: [],                    // Lista de movimientos (cabeceras)
  status: 'idle'|'loading'|'succeeded'|'failed',
  error: null,
  detallesPorMovimiento: {}    // Cache { [movimientoId]: detalles[] }
}
```

| Selector                       | Thunks                                                       |
| ------------------------------ | ------------------------------------------------------------ |
| `selectMovimientos`            | `fetchMovimientos` (con subconsulta de conteo)               |
| `selectMovimientosLoading`     | `addMovimiento` (cabecera + detalles)                        |
| `selectMovimientosError`       | `updateMovimiento` (update cabecera, delete+insert detalles) |
| `selectDetallesByMovimientoId` | `deleteMovimiento` (cascada)                                 |
|                                | `fetchDetallesByMovimientoId` (bajo demanda + cache)         |

### Detalles Técnicos

- **IDs temporales**: `genTempId()` combina `Date.now()` con contador
  incremental para evitar colisiones en claves React.
- **Validación integer**: campos `estado_activo_anterior`/`nuevo` se envían como
  `null` cuando están vacíos para evitar error PostgreSQL.
- **Subconsulta de conteo**: `movimientos_detalle(count)` en Supabase.

---

## 13. Asignaciones (`/asignaciones/*`) — Tabla: `asignaciones`

Gestiona la asignación directa de activos fijos a funcionarios.

### Campos del Formulario

| Campo            | Tipo         | Descripción                    |
| ---------------- | ------------ | ------------------------------ |
| funcionario_id   | integer (FK) | FK → `funcionarios.id`         |
| activo_fijo_id   | integer (FK) | FK → `activos_fijos.id`        |
| fecha_asignacion | date         | Fecha de asignación            |
| fecha_devolucion | date         | Fecha de devolución (opcional) |
| estado           | text         | Estado de la asignación        |

### Listado

| Columna          | Display                  |
| ---------------- | ------------------------ |
| ID               | `id`                     |
| Funcionario      | Nombre del funcionario   |
| Activo Fijo      | Denominación del activo  |
| Fecha Asignación | `fecha_asignacion`       |
| Fecha Devolución | `fecha_devolucion` o "—" |
| Estado           | Badge con `estado`       |
| Acciones         | Editar, Eliminar         |

### Store

| Selector                    | Thunks                                 |
| --------------------------- | -------------------------------------- |
| `selectAsignaciones`        | `fetchAsignaciones`, `addAsignacion`   |
| `selectSortedAsignaciones`  | `updateAsignacion`, `deleteAsignacion` |
| `selectAsignacionesLoading` |                                        |
| `selectAsignacionesError`   |                                        |

---

## Navegación

La barra de navegación (`src/components/navbar/`) se configura en
`src/config/navigation.js` y organiza los módulos en:

| Menú          | Rutas                                                                                   |
| ------------- | --------------------------------------------------------------------------------------- |
| Inicio        | `/`                                                                                     |
| Configuración | Países, Departamentos, Provincias, Municipios, Ubicaciones, Entidades, Unidades, Cargos |
| Funcionarios  | `/funcionarios`                                                                         |
| Activos Fijos | `/activos`                                                                              |
| Movimientos   | `/movimientos`                                                                          |
| Asignaciones  | `/asignaciones`                                                                         |
| Revalúo       | `/`                                                                                     |

## Enrutamiento (`src/router/AppRouter.jsx`)

- `/auth/*` → `PublicRoute` (redirige a `/` si autenticado)
- Resto de rutas → `PrivateRoute` (redirige a `/auth/activosfijos` si no autenticado,
  guarda `lastPath` en localStorage)

## Autenticación y Seguridad

1. **Login**: email/password o Google SSO mediante Supabase Auth.
2. **Callback OAuth**: captura sesión, redirige a última ruta visitada.
3. **Roles**: `registro` y `supervisor` almacenados en tabla `users`.
4. **Persistencia**: sesión manejada por Supabase, datos de usuario en localStorage.

## Modelo de Datos Relacional (Supabase PostgreSQL)

```
paises 1 ──── N departamentos
departamentos 1 ──── N provincias
provincias 1 ──── N municipios
municipios 1 ──── N ubicaciones

tipos_activo 1 ──── N activos_fijos
unidades 1 ──── N activos_fijos
municipios 1 ──── N activos_fijos
entidades 1 ──── N activos_fijos
ubicaciones 1 ──── N activos_fijos
estados_activo 1 ──── N activos_fijos

cargos 1 ──── N funcionarios
entidades 1 ──── N funcionarios
ubicaciones 1 ──── N funcionarios

movimientos_cabecera 1 ──── N movimientos_detalle
activos_fijos 1 ──── N movimientos_detalle
estados_activo 1 ──── N movimientos_detalle (anterior)
estados_activo 1 ──── N movimientos_detalle (nuevo)

funcionarios 1 ──── N movimientos_cabecera (origen)
funcionarios 1 ──── N movimientos_cabecera (destino)
funcionarios 1 ──── N movimientos_cabecera (aprobador)
ubicaciones 1 ──── N movimientos_cabecera (origen)
ubicaciones 1 ──── N movimientos_cabecera (destino)

funcionarios 1 ──── N asignaciones
activos_fijos 1 ──── N asignaciones
```

## Convenciones de Código

- **Nombres de archivos**: PascalCase para componentes (`ActivosFijosList.jsx`),
  camelCase para utilidades (`mapFields.js`).
- **Selectores**: prefijo `select` (`selectFuncionarios`).
- **Thunks**: prefijo de acción (`fetchFuncionarios`, `addFuncionario`).
- **Estado Redux**: `{ data, status, error }` en todos los slices CRUD.
- **Formularios**: estados iniciales como constantes `*_INITIAL` fuera del componente.
- **Componentes**: 1 archivo por componente funcional con hooks.
