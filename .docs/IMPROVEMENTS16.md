# Walkthrough de Actualizaciones

A continuación se detallan los últimos cambios aplicados al sistema.

## Control de Acceso por Roles (RBAC)

Se ha implementado una seguridad robusta en toda la aplicación para diferenciar entre Administradores y Usuarios comunes, tanto a nivel visual como de acceso por rutas (URL).

### Cambios Realizados
- **[MODIFY] Autenticación**: En `supabaseAuth.js` y `useCheckAuth.js`, ahora tras cada inicio o recuperación de sesión, el sistema realiza una consulta a la tabla `rol` (`SELECT rol FROM rol WHERE UID = user.id`). 
  - Si el registro existe, el rol asignado en Redux será su contenido (ej. "Administrador").
  - Si no existe, se asignará el rol "Usuario".
- **[MODIFY] Menú de Navegación**: 
  - En `navigation.js`, se introdujo el atributo `adminOnly: true` para todas las opciones de menú excepto `Inventario` y `Asignaciones`.
  - En `useNavbar.js`, si el rol del usuario actual es "Usuario", los menús restringidos se filtran y desaparecen inmediatamente de la barra superior e inferior.
- **[NEW] Componente `AdminRoute`**: Se creó un *Guardián de Rutas* (`AdminRoute.jsx`) que evalúa el estado global `role` de Redux en tiempo real. 
  - Si un usuario no administrador intenta acceder directamente tipeando una URL (ej. `/configuracion` o `/activos`), será redirigido instantáneamente a la página permitida `/inventario`.
- **[MODIFY] `AppRouter.jsx`**: Se envolvió todas las rutas exclusivas de administración dentro del nuevo `<AdminRoute>`, garantizando que el acceso directo por navegador esté completamente blindado.

### Validación
- Compilado de Vite verificado (`✓ built in 8.77s`).
- El estado y la protección de accesos se manejan en memoria con Redux persistido por `localStorage` (como ya funcionaba antes), asegurando un rendimiento veloz sin interrupciones visuales ni re-renderizaciones erróneas.

---

<details>
<summary>Ver detalles de iteraciones previas</summary>

### Modal de Vista Previa Enriquecida para Actas
- Se implementó `ActaPreviewModal` que descarga la información de la base de datos antes de generar el PDF.
- Se eliminó el "doble scroll" externo, manteniendo el scroll únicamente en la tabla.
- Se ajustaron las columnas de **Descripción**, **Observaciones** y **Ubicación** limitadas a anchos máximos con saltos de línea inteligentes (text wrapping) para eliminar el scroll horizontal indeseado en la tabla.

### Ordenamiento Alfabético de Responsables
- `responsableSlice.js`: Los responsables se ordenan: `paterno` -> `materno` -> `nombre1` -> `nombre2`.

### Refactorización Clean Code
- Múltiples optimizaciones con custom hooks y `React.memo` en toda la aplicación.
</details>
