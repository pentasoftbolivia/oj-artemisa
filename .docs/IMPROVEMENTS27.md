# Resumen de Cambios en Autenticación y Autorización (Rol Inventariador)

Se completaron exitosamente los ajustes en la autenticación y control de acceso (autorización) para los usuarios con rol **Inventariador**.

## Cambios Realizados

1. **Redirección Inmediata al Iniciar Sesión (`LoginPage.jsx` & `AuthCallback.jsx`)**:
   - Si el usuario se autentica y en la tabla `rol` su rol es `"Inventariador"`, se establece inmediatamente la ruta de navegación en `/inventario` y se le redirige al componente `/inventario`.

2. **Restricción de Rutas No Autorizadas y de la Ruta Principal (`AppRouter.jsx`)**:
   - Se protegieron las rutas `/` e `/inicio/*` con `<AdminRoute>`.
   - Cuando un usuario con rol `"Inventariador"` intenta acceder a la raíz `/` o a `/inicio/*`, el guard `<AdminRoute>` intercepta el intento de navegación y lo redirige de inmediato a `/inventario`.
   - Se incorporó la ruta comodín `path="*"` que evalúa el rol del usuario en caso de acceder a cualquier otra ruta no existente o no autorizada, redirigiendo a `/inventario` para usuarios con rol `"Inventariador"`.

3. **Restricción en Navegación Pública (`PublicRoute.jsx`)**:
   - Si un usuario ya autenticado con rol `"Inventariador"` ingresa a la pantalla de login (`/auth/*`), la ruta pública los redirige directamente a `/inventario` en lugar de `/`.

4. **Ajuste en la Barra de Navegación (`Navbar.jsx`)**:
   - El clic sobre el logotipo de la aplicación redirige a `/inventario` si el usuario posee el rol `"Inventariador"`.

---

## Verificación de Calidad y Pruebas Realizadas

- **ESLint**: 0 errores o advertencias en los módulos modificados.
- **Vite Production Build**: Compilación limpia y optimizada (build en 7.53s).
