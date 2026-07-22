# Refactorización a React Hook Form

Se ha completado la migración del componente `MovimientosForm.jsx` al uso de `react-hook-form` con validación en `zod`.

## Cambios Realizados

- **Instalación de Dependencias**: Se instalaron `react-hook-form`, `zod` y `@hookform/resolvers` como parte de los estándares modernos para formularios en React.
- **Validación Declarativa (zod)**:
  - Se crearon los esquemas `detalleSchema` y `formSchema`.
  - Se implementó la regla personalizada en `zod` para exigir al menos un funcionario (origen o destino).
- **Gestión de Estado Unificado (`useForm`)**:
  - Los múltiples estados (`cabeceraForm`, `errors`) fueron reemplazados por el hook nativo de la librería.
  - Los inputs nativos usan `register("nombre")` y los componentes de UI complejos (Select, ComboboxField) están encapsulados en `<Controller>`.
- **Tabla de Detalles (`useFieldArray`)**:
  - Se integró la tabla de detalles directamente en el estado del formulario principal.
  - Al hacer click en "Agregar", se llama a la función `append()`, y para eliminar, a la función `remove()`. Para editar, se llama a `update()`.

## Beneficios
- **Performance**: Ahora el formulario ya no sufre un re-render global con cada carácter tipado en campos de texto (ej. "Motivo" u "Observaciones").
- **Validación Centralizada**: Todos los errores de validación y la lógica requerida se encuentran en la cabecera en el esquema de Zod, en lugar de esparcidos por el evento `handleSubmit`.
- **DRY y KISS**: El archivo es más corto, y no hace falta un manejo de identificadores temporales extraños (`genTempId()`) porque `useFieldArray` provee una propiedad `id` generada internamente para cada `field` que garantiza listas eficientes en React.

> [!TIP]
> Prueba interactuar con los campos de texto grandes o hacer submit con el formulario vacío para ver cómo los errores se muestran al instante sin penalizar el rendimiento.
