import { supabase } from "@/lib/supabase";
import { normalizeCi } from "../constants/inventarioConstants";
import { ACTIVO_COLUMNS } from "@/lib/activoColumns";

const BUCKET_NAME = "imagenes";

/**
 * Actualiza los campos de un activo por su codigoactivointerno.
 */
export const updateActivoFields = async (codigoActivoInterno, fieldsToUpdate) => {
  const { data, error } = await supabase
    .from("act_activos")
    .update(fieldsToUpdate)
    .eq("codigoactivointerno", codigoActivoInterno);
  if (error) throw error;
  return data;
};

/**
 * Registra y transfiere la información de un activo (cambia ultimoregistro y crea nuevo registro).
 */
export const registerAndTransferActivo = async (
  editActivo,
  editForm,
  currentUserEmail,
  rubroFields = []
) => {
  const userEmail = currentUserEmail || "unknown";

  const { error: updateError } = await supabase
    .from("act_activos")
    .update({ ultimoregistro: 0, estadoinventario: "INVENTARIADO" })
    .eq("codigoactivointerno", editActivo.codigoActivoInterno);

  if (updateError) throw updateError;

  const newRecord = {
    codigoactivo: editActivo.codigoActivo,
    codigotransaccion: editActivo.codigoTransaccion,
    codigoambiente: editForm.codigoAmbiente || editActivo.codigoAmbiente,
    cirun: normalizeCi(editActivo.cirun),
    descripcionactivo: editForm.descripcionActivo,
    tiporubroact: editActivo.tipoRubroAct,
    serie: editActivo.serie,
    marcamaterial: editActivo.marcaMaterial,
    estado: editActivo.estado,
    observaciones: editForm.observaciones || editActivo.observaciones,
    valoractual: editActivo.valorActual,
    ultimoregistro: 1,
    estadoconservacion:
      editForm.estadoConservacion || editActivo.estadoconservacion,
    usuarioinventario: userEmail,
    estadoinventario: "PENDIENTE",
  };

  rubroFields.forEach((f) => {
    const val = editForm[f.key];
    if (val) newRecord[f.key] = val;
  });

  const { data, error: insertError } = await supabase
    .from("act_activos")
    .insert(newRecord);

  if (insertError) throw insertError;
  return data;
};

/**
 * Actualiza el estado de inventario (e.g. REVISADO, INVENTARIADO, ENVIADO).
 */
export const updateEstadoInventario = async (codigoActivoInterno, updateData) => {
  const { data, error } = await supabase
    .from("act_activos")
    .update(updateData)
    .eq("codigoactivointerno", codigoActivoInterno);
  if (error) throw error;
  return data;
};

/**
 * Obtiene la lista de fotos asociadas a un activo desde Supabase Storage.
 */
export const fetchActivoImages = async (codigoActivo) => {
  const prefix = `${codigoActivo}_`;
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list("", { search: prefix, sortBy: { column: "name", order: "asc" } });

  if (error) throw error;
  if (!data) return [];

  return data
    .filter((f) => f.name.startsWith(prefix))
    .map((f) => ({
      name: f.name,
      url: supabase.storage.from(BUCKET_NAME).getPublicUrl(f.name).data.publicUrl,
    }));
};

/**
 * Sube múltiples fotos para un activo a Supabase Storage.
 */
export const uploadActivoImages = async (codigoActivo, files) => {
  const uploadedNames = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const fileName = `${codigoActivo}_${Date.now()}_${i}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file);
    if (error) throw error;
    uploadedNames.push(fileName);
  }
  return uploadedNames;
};

/**
 * Elimina una foto por nombre de archivo desde Supabase Storage.
 */
export const deleteActivoImage = async (fileName) => {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([fileName]);
  if (error) throw error;
};

/**
 * Obtiene los CI/RUN de la tabla act_responsable.
 */
export const fetchResponsablesCiRun = async () => {
  const { data, error } = await supabase
    .from("act_responsable")
    .select("cirun");
  if (error) throw error;
  return data;
};

/**
 * Obtiene el conteo total del universo de activos (head count).
 */
export const fetchUniversoTotalCount = async () => {
  const { count, error } = await supabase
    .from("act_activos")
    .select("codigoactivointerno", { count: "exact", head: true });
  if (error) throw error;
  return count || 0;
};

/**
 * Carga usuarios y estados para estadísticas de inventariadores.
 */
export const fetchInventariadoresStatsData = async () => {
  const { data, error } = await supabase
    .from("act_activos")
    .select("usuarioinventario,estadoinventario");
  if (error) throw error;
  return data || [];
};

/**
 * Carga el resumen de un inmueble (conteo total y revisados).
 */
export const fetchInmuebleSummaryData = async (codes) => {
  if (!codes || codes.length === 0) {
    return { count: 0, revisadosCount: 0 };
  }
  const [totalRes, revisadosRes] = await Promise.all([
    supabase
      .from("act_activos")
      .select("codigoactivointerno", { count: "exact", head: true })
      .in("codigoambiente", codes),
    supabase
      .from("act_activos")
      .select("codigoactivointerno", { count: "exact", head: true })
      .in("codigoambiente", codes)
      .eq("estadoinventario", "REVISADO"),
  ]);

  return {
    count: totalRes.count || 0,
    revisadosCount: revisadosRes.count || 0,
  };
};

/**
 * Carga activos por lista de códigos de ambientes y estado de inventario.
 */
export const fetchActivosByAmbienteYEstado = async (ambCodes, estadoInventario) => {
  if (!ambCodes || ambCodes.length === 0) return [];
  let query = supabase
    .from("act_activos")
    .select(ACTIVO_COLUMNS)
    .in("codigoambiente", ambCodes);

  if (Array.isArray(estadoInventario)) {
    query = query.in("estadoinventario", estadoInventario);
  } else if (estadoInventario) {
    query = query.eq("estadoinventario", estadoInventario);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

/**
 * Carga activos registrados por rango de fechas.
 */
export const fetchActivosPorFechaData = async (startDate, endDate) => {
  let query = supabase
    .from("act_activos")
    .select("usuarioinventario,estadoinventario,fecharegistro")
    .not("fecharegistro", "is", null);

  if (startDate) {
    query = query.gte("fecharegistro", `${startDate}T00:00:00`);
  }
  if (endDate) {
    query = query.lte("fecharegistro", `${endDate}T23:59:59`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};
