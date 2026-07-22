/**
 * Tipos de reportes disponibles en el sistema
 */
export const REPORT_TYPES = {
  PRODUCT_KARDEX: 'product_kardex',
  MATERIAL_KARDEX: 'material_kardex',
  PRODUCT_LIST: 'product_list',
  MATERIAL_LIST: 'material_list',
  INVENTORY_REPORT: 'inventory_report',
  MOVEMENT_REPORT: 'movement_report'
};

/**
 * Configuración de columnas para cada tipo de reporte
 */
export const REPORT_COLUMNS = {
  [REPORT_TYPES.PRODUCT_KARDEX]: [
    'FECHA', 'TIPO', 'ENTRADAS CANTIDAD', 'PRECIO UNITARIO',
    'SALIDAS CANTIDAD', 'PRECIO UNITARIO', 'SALDOS CANTIDAD',
    'COSTO UNITARIO', 'VALOR TOTAL'
  ],
  [REPORT_TYPES.MATERIAL_KARDEX]: [
    'FECHA', 'TIPO', 'ENTRADAS CANTIDAD', 'PRECIO UNITARIO',
    'SALIDAS CANTIDAD', 'PRECIO UNITARIO', 'SALDOS CANTIDAD',
    'COSTO PROMEDIO', 'VALOR TOTAL'
  ],
  [REPORT_TYPES.PRODUCT_LIST]: [
    'CÓDIGO', 'NOMBRE', 'TIPO', 'STOCK', 
    'STOCK MÍNIMO', 'PRECIO', 'PRESENTACIÓN'
  ]
};

/**
 * Configuración de estilos de columna para cada tipo de reporte
 */
export const COLUMN_STYLES = {
  [REPORT_TYPES.PRODUCT_KARDEX]: {
    0: { cellWidth: 25, halign: 'center' }, // Fecha
    1: { cellWidth: 25, halign: 'center' }, // Tipo
    2: { cellWidth: 25, halign: 'right' },  // Entrada Cantidad
    3: { cellWidth: 25, halign: 'right' },  // Precio Unitario Entrada
    4: { cellWidth: 25, halign: 'right' },  // Salida Cantidad
    5: { cellWidth: 25, halign: 'right' },  // Precio Unitario Salida
    6: { cellWidth: 25, halign: 'right' },  // Saldo Cantidad
    7: { cellWidth: 25, halign: 'right' },  // Costo Promedio
    8: { cellWidth: 30, halign: 'right' }   // Valor Total
  },
  [REPORT_TYPES.MATERIAL_KARDEX]: {
    0: { cellWidth: 25, halign: 'center' }, // Fecha
    1: { cellWidth: 25, halign: 'center' }, // Tipo
    2: { cellWidth: 25, halign: 'right' },  // Entrada Cantidad
    3: { cellWidth: 25, halign: 'right' },  // Precio Unitario Entrada
    4: { cellWidth: 25, halign: 'right' },  // Salida Cantidad
    5: { cellWidth: 25, halign: 'right' },  // Precio Unitario Salida
    6: { cellWidth: 25, halign: 'right' },  // Saldo Cantidad
    7: { cellWidth: 25, halign: 'right' },  // Costo Promedio
    8: { cellWidth: 30, halign: 'right' }   // Valor Total
  }
};

export default {
  REPORT_TYPES,
  REPORT_COLUMNS,
  COLUMN_STYLES
};
