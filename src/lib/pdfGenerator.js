const ENTITY_NAME = 'ÓRGANO JUDICIAL - LA PAZ';
const ENTITY_NIT = 'NIT: 123456789';
const PDF_LOCALE = 'es-BO';
const PDF_CURRENCY = 'BOB';

// Función para generar PDF usando jsPDF y jspdf-autotable
export const generateMaterialsPDF = async (data) => {
  try {
    // Importación dinámica de las dependencias
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    
    // Crear instancia de jsPDF
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    // Estilos
    const primaryColor = [41, 128, 185];
    const textColor = [51, 51, 51];
    
    // Encabezado
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('INVENTARIO DE MATERIALES', 148, 15, { align: 'center' });
    
    // Información de la empresa
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(ENTITY_NAME, 148, 28, { align: 'center' });
    doc.setFontSize(10);
    doc.text(ENTITY_NIT, 148, 35, { align: 'center' });
    
    // Datos transformados
    const tableData = data.map(item => ({
      codigo: item.skucode || '',
      material: item.name || '',
      tipo: item.materialtype?.name || item.materialType || '',
      stock: item.stock || 0,
      minimo: item.minimumstock || 0,
      costo: item.unitcost || 0,
      proveedor: item.provider?.businessname || item.providerName || ''
    }));
    
    // Crear tabla
    autoTable(doc, {
      head: [['#', 'CÓDIGO', 'MATERIAL', 'TIPO', 'STOCK', 'MÍNIMO', 'COSTO UNITARIO', 'PROVEEDOR']],
      body: tableData.map((item, index) => [
        (index + 1).toString(),
        item.codigo,
        item.material,
        item.tipo,
        { content: item.stock.toString(), styles: { halign: 'right' } },
        { content: item.minimo.toString(), styles: { halign: 'right' } },
        { 
          content: new Intl.NumberFormat(PDF_LOCALE, {
            style: 'currency',
            currency: PDF_CURRENCY,
            minimumFractionDigits: 2
          }).format(item.costo || 0),
          styles: { halign: 'right' }
        },
        item.proveedor
      ]),
      startY: 40,
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        cellPadding: 3
      },
      columnStyles: {
        0: { cellWidth: 14, halign: 'center' },
        1: { cellWidth: 25, halign: 'left' },
        2: { cellWidth: 65, halign: 'left' },
        3: { cellWidth: 30, halign: 'left' },
        4: { cellWidth: 20, halign: 'right' },
        5: { cellWidth: 20, halign: 'right' },
        6: { cellWidth: 30, halign: 'right' },
        7: { cellWidth: 65, halign: 'left' }
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
        lineColor: [100, 100, 100],
        lineWidth: 0.2,
        textColor: textColor,
        overflow: 'linebreak',
        fillColor: [255, 255, 255],
        valign: 'middle'
      },
      tableLineColor: [100, 100, 100],
      tableLineWidth: 0.2
    });
    
    // Generar el blob del PDF
    const pdfBlob = doc.output('blob');
    return pdfBlob;
  } catch (error) {
    console.error('Error al generar el PDF:', error);
    return null;
  }
};

// Función para generar PDF de movimientos
const generateMovementsPDF = async (data) => {
  try {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    // Estilos
    const primaryColor = [41, 128, 185];
    const textColor = [51, 51, 51];
    
    // Encabezado
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('REPORTE DE MOVIMIENTOS DE MATERIALES', 148, 15, { align: 'center' });
    
    // Información de la empresa
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(ENTITY_NAME, 148, 25, { align: 'center' });
    doc.setFontSize(10);
    doc.text(ENTITY_NIT, 148, 30, { align: 'center' });
    
    // Datos transformados
    const tableData = data.map(item => {
      const unitCost = typeof item.movementunitcost === 'number' ? item.movementunitcost : 
                      (typeof item.costoUnitario === 'string' && item.costoUnitario.startsWith('$') ? 
                       parseFloat(item.costoUnitario.replace(/[^0-9.-]+/g,"")) : item.movementunitcost || 0);
      
      const quantity = item.quantity || 0;
      const total = item.total || (quantity * unitCost);
      
      return {
        fecha: item.fecha || item.movementdate?.toLocaleDateString?.() || 'N/A',
        tipo: item.tipo || (item.movementtype === 'ingreso' ? 'Ingreso' : 'Salida'),
        documento: item.documento || item.reference || 'N/A',
        material: item.material || item.materialName || 'N/A',
        cantidad: quantity,
        costo: unitCost,
        total: total
      };
    });
    
    // Crear tabla
    autoTable(doc, {
      head: [['FECHA', 'TIPO', 'DOCUMENTO', 'MATERIAL', 'CANTIDAD', 'COSTO UNITARIO', 'TOTAL']],
      body: tableData.map(item => [
        item.fecha,
        item.tipo,
        item.documento,
        item.material,
        { content: item.cantidad.toString(), styles: { halign: 'right' } },
        { 
          content: new Intl.NumberFormat(PDF_LOCALE, {
            style: 'currency',
            currency: PDF_CURRENCY,
            minimumFractionDigits: 2
          }).format(item.costo || 0),
          styles: { halign: 'right' }
        },
        { 
          content: new Intl.NumberFormat(PDF_LOCALE, {
            style: 'currency',
            currency: PDF_CURRENCY,
            minimumFractionDigits: 2
          }).format(item.total || 0),
          styles: { halign: 'right', fontStyle: 'bold' }
        }
      ]),
      startY: 35,
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        cellPadding: 3
      },
      columnStyles: {
        0: { cellWidth: 20, halign: 'center' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 30, halign: 'left' },
        3: { cellWidth: 60, halign: 'left' },
        4: { cellWidth: 20, halign: 'right' },
        5: { cellWidth: 30, halign: 'right' },
        6: { cellWidth: 30, halign: 'right' }
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
        lineColor: [100, 100, 100],
        lineWidth: 0.2,
        textColor: textColor,
        overflow: 'linebreak',
        fillColor: [255, 255, 255],
        valign: 'middle'
      },
      tableLineColor: [100, 100, 100],
      tableLineWidth: 0.2
    });
    
    // Pie de página
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(
        `Página ${i} de ${pageCount}`,
        doc.internal.pageSize.width - 20,
        doc.internal.pageSize.height - 10,
        { align: 'right' }
      );
      doc.text(
        new Date().toLocaleDateString(PDF_LOCALE),
        10,
        doc.internal.pageSize.height - 10,
        { align: 'left' }
      );
    }
    
    // Generar el blob del PDF
    const pdfBlob = doc.output('blob');
    return pdfBlob;
  } catch (error) {
    console.error('Error al generar el PDF de movimientos:', error);
    throw error;
  }
};

export const downloadPDF = async (data, filename = 'reporte_movimientos.pdf', type = 'materials') => {
  try {
    let pdfBlob;
    
    // Asegurarse de que los datos tengan los campos necesarios
    const processedData = data.map(item => {
      // Si ya tiene los campos formateados, usarlos directamente
      if (item.costoUnitario !== undefined) {
        return item;
      }
      
      // Si no, formatear los campos necesarios
      return {
        ...item,
        fecha: item.fecha || formatDate(item.movementdate),
        tipo: item.tipo || (item.movementtype === 'ingreso' ? 'Ingreso' : 'Salida'),
        cantidad: item.cantidad || item.quantity || 0,
        costoUnitario: item.costoUnitario || item.movementunitcost || 0,
        total: item.total || item.totalmovement || 0,
        lote: item.lote || item.batch || 'N/A',
        proveedor: item.proveedor || item.providerId || 'N/A',
        material: item.material || item.materialName || 'N/A',
        documento: item.documento || item.reference || 'N/A'
      };
    });
    
    if (type === 'materials') {
      pdfBlob = await generateMaterialsPDF(processedData);
    } else if (type === 'movements') {
      pdfBlob = await generateMovementsPDF(processedData);
    } else {
      throw new Error('Tipo de reporte no válido');
    }
    
    // Crear un enlace temporal para la descarga
    const url = window.URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    
    // Simular clic en el enlace para iniciar la descarga
    document.body.appendChild(link);
    link.click();
    
    // Limpiar
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
  } catch (error) {
    console.error('Error al generar el PDF:', error);
    throw error;
  }
};

// Función auxiliar para formatear fechas
const formatDate = (dateValue) => {
  if (!dateValue) return 'N/A';
  
  let date;
  
  // Manejar diferentes formatos de fecha de entrada
  if (dateValue instanceof Date) {
    date = dateValue;
  } else if (typeof dateValue === 'string' || typeof dateValue === 'number') {
    date = new Date(dateValue);
  } else if (dateValue.seconds) {
    // Formato de Firebase Timestamp
    date = new Date(dateValue.seconds * 1000);
  } else if (dateValue._seconds) {
    // Formato alternativo de Firebase Timestamp
    date = new Date(dateValue._seconds * 1000);
  } else if (dateValue.toDate) {
    // Si es un Timestamp de Firestore
    date = dateValue.toDate();
  } else {
    // Intentar convertir a fecha de cualquier otra manera
    date = new Date(dateValue);
  }
  
  // Verificar si la fecha es válida
  if (isNaN(date.getTime())) {
    console.warn('Fecha inválida:', dateValue);
    return 'N/A';
  }
  
  // Formatear la fecha como DD/MM/YYYY HH:MM AM/PM
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // La hora '0' debe ser '12'
  
  return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
};
