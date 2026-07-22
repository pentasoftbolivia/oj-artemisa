# Lazy Loading (carga diferida) en el enrutador principal (AppRouter.jsx). - Walkthrough

## 🎯 Logros

- Reemplacé las importaciones síncronas estáticas de las rutas de cada módulo por la función React.lazy().
- Envolví la declaración general de <Routes> en un <Suspense> de React.
- Asigné el componente preexistente <LoadingSpinner /> para que se muestre como fallback (una pantalla de carga) en el pequeño lapso de tiempo en el que se descarga el módulo solicitado.

## 🎯 Resultados de la Optimización 📉

Para verificarlo, acabo de ejecutar npm run build. Los resultados son espectaculares. Vite (el empaquetador) ahora dividió inteligentemente nuestra aplicación en chunks (fragmentos) independientes, como:

ActivosFijosRoutes.js (159 KB)
MovimientosRoutes.js (30 KB)
FuncionariosRoutes.js (23 KB)
PaisesRoutes.js (5 KB)

Como ahora el código está dividido en estos fragmentos, el navegador solo descarga el código esencial al iniciar. El enorme módulo de "Activos Fijos" solo se descarga cuando el usuario hace clic en él, mejorando dramáticamente el tiempo de carga inicial.
