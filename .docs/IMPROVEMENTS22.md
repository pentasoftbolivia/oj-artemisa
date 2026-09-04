# Walkthrough: Ajuste de Autenticación y Autorización por Roles

Se ha completado el ajuste del proceso de autenticación y autorización en el proyecto **oj-artemisa**.

## Cambios Realizados

### 1. Librería de Autenticación ([`supabaseAuth.js`](file:///c:/Users/sistemas.DESKTOP-9S5I4DS/2026/auditoresmj/inventario/dev/oj-artemisa/src/lib/supabaseAuth.js))
- **`getRoleForUser`**: Ahora retorna `null` en lugar del rol por defecto `"Usuario"` cuando la consulta a la tabla `rol` no encuentra un registro para el `UID` del usuario o falla.
- **`loginUserWithEmailPassword`**: Verifica que el usuario tenga un rol en la tabla `rol`. Si no cuenta con rol asignado (`!role`), ejecuta automáticamente `supabase.auth.signOut()` y devuelve el error: `"Usuario no autorizado. No se encontró un rol asignado en el sistema."`.

### 2. Verificación Continua de Sesión ([`useCheckAuth.js`](file:///c:/Users/sistemas.DESKTOP-9S5I4DS/2026/auditoresmj/inventario/dev/oj-artemisa/src/hooks/useCheckAuth.js))
- Al iniciar o restaurar una sesión activa de Supabase, si `getRoleForUser` retorna `null`, se cierra la sesión (`signOut`), se remueve la información de `localStorage` y se notifica el cierre de sesión no autorizado.

### 3. Protección de Rutas Administrativas ([`AdminRoute.jsx`](file:///c:/Users/sistemas.DESKTOP-9S5I4DS/2026/auditoresmj/inventario/dev/oj-artemisa/src/router/AdminRoute.jsx))
- Se actualizó la condición para validar explícitamente `role === "Administrador"`.
- Los usuarios con el rol `"Inventariador"` que intenten ingresar a rutas administrativas son redirigidos automáticamente a `/inventario`.

### 4. Navegación e Interfaz de Usuario ([`useNavbar.js`](file:///c:/Users/sistemas.DESKTOP-9S5I4DS/2026/auditoresmj/inventario/dev/oj-artemisa/src/components/navbar/useNavbar.js) e [`InventarioTable.jsx`](file:///c:/Users/sistemas.DESKTOP-9S5I4DS/2026/auditoresmj/inventario/dev/oj-artemisa/src/inventario/components/InventarioTable.jsx))
- En `useNavbar.js`, la bandera `isAdmin` evalúa exclusivamente `user?.role === "Administrador"`.
  - **Administrador**: Visualiza todo el menú de navegación (Configuración, Activos Fijos, Responsables, Inventario, Asignaciones).
  - **Inventariador**: Visualiza únicamente los módulos `/inventario` y `/asignaciones`.
- En `InventarioTable.jsx`, se actualizaron las comprobaciones para permitir el acceso a las acciones de la tabla a usuarios autorizados.

---

## Verificación

- **Compilación**: Se ejecutó `npm run build` con éxito sin ningún error de TypeScript/JavaScript ni problemas de empaquetado.
