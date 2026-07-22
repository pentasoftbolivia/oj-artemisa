import { supabase } from "@/lib/supabase";

const CABECERA_TABLE = "movimientos_cabecera";
const DETALLE_TABLE = "movimientos_detalle";
const CHUNK_SIZE = 1000;

export const getAllMovimientos = async () => {
  let allData = [];
  let start = 0;
  let chunk;
  do {
    const { data, error } = await supabase
      .from(CABECERA_TABLE)
      .select("*, movimientos_detalle:movimientos_detalle(count)")
      .order("id", { ascending: true })
      .range(start, start + CHUNK_SIZE - 1);
    if (error) throw error;
    chunk = data || [];
    allData = allData.concat(chunk);
    start += CHUNK_SIZE;
  } while (chunk.length === CHUNK_SIZE);
  return allData;
};

export const createMovimiento = async (cabecera, detalles) => {
  const { data: cabeceraData, error: cabError } = await supabase
    .from(CABECERA_TABLE)
    .insert(cabecera)
    .select("*")
    .single();
  if (cabError) throw cabError;

  const cleanDetalles = detalles.map((d, i) => {
    const rest = { ...d };
    delete rest.imagenes_adjuntas;
    return {
      ...rest,
      movimiento_id: cabeceraData.id,
      numero_linea: rest.numero_linea || i + 1,
    };
  });

  const { data: detallesData, error: detError } = await supabase
    .from(DETALLE_TABLE)
    .insert(cleanDetalles)
    .select("*");
  if (detError) throw detError;

  const imagenesAInsertar = [];
  
  for (let i = 0; i < detalles.length; i++) {
    const originalRow = detalles[i];
    const imagenesOriginales = originalRow.imagenes_adjuntas;
    
    if (imagenesOriginales && imagenesOriginales.length > 0) {
      const lineToMatch = originalRow.numero_linea || i + 1;
      const detalleGuardado = detallesData.find(d => d.numero_linea === lineToMatch);
      
      if (detalleGuardado) {
        for (let j = 0; j < imagenesOriginales.length; j++) {
          const file = imagenesOriginales[j];
          const fileExt = file.name.split('.').pop();
          const fileName = `${cabeceraData.id}/${detalleGuardado.id}/${Date.now()}_${j}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from("imagenes_inventario")
            .upload(fileName, file);
            
          if (uploadError) {
            console.error("Error subiendo imagen:", uploadError);
          } else {
            const { data: publicUrlData } = supabase.storage
              .from("imagenes_inventario")
              .getPublicUrl(fileName);
              
            imagenesAInsertar.push({
              movimiento_detalle_id: detalleGuardado.id,
              url: publicUrlData.publicUrl,
              estado: "ACTIVO",
            });
          }
        }
      }
    }
  }

  if (imagenesAInsertar.length > 0) {
    const { error: imgError } = await supabase
      .from("movimientos_detalle_imagenes")
      .insert(imagenesAInsertar);
    if (imgError) {
      console.error("Error insertando registros de imágenes:", imgError);
    }
  }

  if (cabecera.funcionario_destino_id) {
    const asignacionesData = detallesData.map((detalle) => ({
      activo_id: detalle.activo_id,
      funcionario_id: cabecera.funcionario_destino_id,
      activa: true,
      fecha_asignacion: cabecera.fecha_movimiento || new Date().toISOString().split("T")[0],
      movimiento_asig_id: cabeceraData.id,
    }));

    const { error: asigError } = await supabase
      .from("asignaciones")
      .insert(asignacionesData);

    if (asigError) {
      console.error("Error insertando asignaciones:", asigError);
    }
  }

  if (cabecera.funcionario_origen_id && !cabecera.funcionario_destino_id) {
    for (const detalle of detallesData) {
      await supabase
        .from("asignaciones")
        .update({ activa: false, fecha_devolucion: cabecera.fecha_movimiento || new Date().toISOString().split("T")[0] })
        .eq("activo_id", detalle.activo_id)
        .eq("activa", true);
    }

    const devolucionesData = detallesData.map((detalle) => ({
      activo_id: detalle.activo_id,
      funcionario_id: cabecera.funcionario_origen_id,
      activa: false,
      fecha_devolucion: cabecera.fecha_movimiento || new Date().toISOString().split("T")[0],
      movimiento_asig_id: cabeceraData.id,
    }));

    const { error: devError } = await supabase
      .from("asignaciones")
      .insert(devolucionesData);

    if (devError) {
      console.error("Error insertando devoluciones:", devError);
    }
  }

  return { cabecera: cabeceraData, detalles: detallesData };
};

export const editMovimiento = async (id, cabecera, detalles) => {
  const { data: cabeceraData, error: cabError } = await supabase
    .from(CABECERA_TABLE)
    .update(cabecera)
    .eq("id", id)
    .select("*")
    .single();
  if (cabError) throw cabError;

  const { error: delError } = await supabase
    .from(DETALLE_TABLE)
    .delete()
    .eq("movimiento_id", id);
  if (delError) throw delError;

  if (detalles && detalles.length > 0) {
    const detallesConMovimiento = detalles.map((d, i) => ({
      ...d,
      movimiento_id: id,
      numero_linea: d.numero_linea || i + 1,
    }));

    const { data: detallesData, error: detError } = await supabase
      .from(DETALLE_TABLE)
      .insert(detallesConMovimiento)
      .select("*");
    if (detError) throw detError;

    return { cabecera: cabeceraData, detalles: detallesData };
  }

  return { cabecera: cabeceraData, detalles: [] };
};

export const removeMovimiento = async (id) => {
  const { error: detError } = await supabase
    .from(DETALLE_TABLE)
    .delete()
    .eq("movimiento_id", id);
  if (detError) throw detError;

  const { error: cabError } = await supabase
    .from(CABECERA_TABLE)
    .delete()
    .eq("id", id);
  if (cabError) throw cabError;

  return id;
};

export const getDetalles = async (movimientoId) => {
  const { data, error } = await supabase
    .from(DETALLE_TABLE)
    .select("*")
    .eq("movimiento_id", movimientoId)
    .order("numero_linea", { ascending: true });
  if (error) throw error;
  return data || [];
};

export const getImagenesByDetalleId = async (detalleId) => {
  const { data, error } = await supabase
    .from("movimientos_detalle_imagenes")
    .select("*")
    .eq("movimiento_detalle_id", detalleId)
    .order("creado_en", { ascending: true });
  if (error) throw error;
  return data || [];
};

export const deleteImagen = async (imagenId, publicUrl) => {
  // Extraer el path del Storage a partir de la URL pública.
  // La URL pública suele ser: .../storage/v1/object/public/imagenes_inventario/CAB_ID/DET_ID/nombre.jpg
  // El path interno es simplemente CAB_ID/DET_ID/nombre.jpg
  let storagePath = null;
  if (publicUrl) {
    const bucketToken = "imagenes_inventario/";
    const index = publicUrl.indexOf(bucketToken);
    if (index !== -1) {
      storagePath = publicUrl.substring(index + bucketToken.length);
    }
  }

  if (storagePath) {
    const { error: storageError } = await supabase.storage
      .from("imagenes_inventario")
      .remove([storagePath]);
    if (storageError) {
      console.error("Error eliminando del Storage:", storageError);
      // No hacemos throw aquí para permitir limpiar la BD si el archivo ya no existe.
    }
  }

  const { error: dbError } = await supabase
    .from("movimientos_detalle_imagenes")
    .delete()
    .eq("id", imagenId);
  
  if (dbError) throw dbError;
  return true;
};
