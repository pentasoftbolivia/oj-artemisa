# Plan de Mejora y Refactorización (Clean Code)

He realizado un análisis estático profundo con `flutter analyze` (el cual arrojó **0 errores**, lo cual es excelente y demuestra que las reglas básicas y el uso de `const` están bastante bien aplicados). Sin embargo, a nivel de arquitectura y limpieza (Clean Code), he identificado áreas clave para mejorar siguiendo las metodologías K.I.S.S. y D.R.Y.

## Observaciones Principales

1. **Monolito en UI (`activo_form_page.dart`)**:
   Este archivo pesa casi 48 KB (más de 1200 líneas). Contiene toda la lógica del formulario y sus múltiples sub-secciones (`_ActivoIdSection`, `_ActivoClassificationSection`, `_ActivoDetailsSection`, `_ActivoRubroFieldsSection`). Esto dificulta el mantenimiento y viola el principio de responsabilidad única.

2. **Fuga de lógica de negocio en la UI (`inventario_list_page.dart`)**:
   El método `_processActivoCode` y los métodos de selección fotográfica hacen llamados directos a los repositorios (`locator.activoRepository.getActivos` y `locator.supabaseClient.storage`). Según Clean Architecture, la UI solo debería despachar eventos al BLoC y escuchar los estados.

3. **Duplicación de código**:
   Existen dos archivos llamados `inventario_list_page.dart` (uno en el módulo `inventario` y otro en `inventario_activo`). Sería ideal revisar si comparten lógica que pueda unificarse, aunque el alcance inicial se centrará en limpiar el código existente.

## Proposed Changes

### Componente `activos_fijos`

Voy a descomponer el formulario gigante en componentes modulares y reutilizables.

#### [NEW] `lib/features/activos_fijos/presentation/widgets/form_sections/activo_id_section.dart`
- Extraeré la clase `_ActivoIdSection`.

#### [NEW] `lib/features/activos_fijos/presentation/widgets/form_sections/activo_classification_section.dart`
- Extraeré la clase `_ActivoClassificationSection` (y su Estado asociado), que maneja las dependencias entre ciudad, inmueble, nivel y ambiente.

#### [NEW] `lib/features/activos_fijos/presentation/widgets/form_sections/activo_details_section.dart`
- Extraeré la sección de detalles generales (serie, marca, modelo).

#### [NEW] `lib/features/activos_fijos/presentation/widgets/form_sections/activo_rubro_fields_section.dart`
- Extraeré la inmensa cantidad de campos condicionales dependientes del rubro.

#### [MODIFY] `lib/features/activos_fijos/presentation/pages/activo_form_page.dart`
- Importará las nuevas secciones.
- Se reducirá su tamaño de ~1300 líneas a unas ~300 líneas, enfocándose únicamente en coordinar el estado general del formulario, la validación global y el guardado.

### Componente `inventario`

#### [MODIFY] `lib/features/inventario/presentation/bloc/inventario_bloc.dart`
- Añadiré un nuevo evento (por ejemplo: `SearchSingleActivoScanned`) para manejar la búsqueda del activo por código, en lugar de hacerlo desde la vista.

#### [MODIFY] `lib/features/inventario/presentation/pages/inventario_list_page.dart`
- Eliminaré la inyección directa de repositorios (`locator.activoRepository.getActivos`).
- Modificaré `_processActivoCode` para despachar el evento al BLoC y reaccionar mediante `BlocListener`.
- Garantizaré el uso estricto de constructores `const` y widgets sin estado (`StatelessWidget`) para las partes extraíbles.

## User Review Required

> [!IMPORTANT]
> Esta refactorización implica mover muchas líneas de código de lugar. El objetivo estricto es **no alterar la funcionalidad ni la UI visible**. Todo seguirá viéndose y funcionando idéntico, pero el código por debajo será mucho más limpio, testeable y mantenible. 
> 
> ¿Estás de acuerdo con iniciar la extracción de estas piezas y la limpieza del BLoC?

## Verification Plan

### Automated Tests
- Ejecutaré `flutter analyze` para asegurar que las nuevas clases extraídas no introduzcan advertencias ni errores.
- Ejecutaré `flutter format` para asegurar un código limpio.

### Manual Verification
- Te pediré que, con la app corriendo, navegues a la página del formulario de edición de activos y realices una actualización para verificar que los estados (como los dropdowns dependientes de Inmueble -> Nivel -> Ambiente) sigan funcionando perfectamente.
- Te pediré que busques/escanees un activo en la vista de Inventario para verificar que el nuevo flujo a través de BLoC siga mostrando el pop-up correctamente.
