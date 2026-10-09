import { supabase } from "@/lib/supabase";
import { normalizeCi } from "../constants/inventarioConstants";
import { ACTIVO_COLUMNS } from "@/lib/activoColumns";

const BUCKET_NAME = "imagenes";
// Bucket exclusivo para respaldos de N° Cotización (subcolumnas 1/2/3 de Revalúo)
export const BUCKET_REVALUO = "revaluo";

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
 * Obtiene el conteo de fotos por activo de TODO el bucket en pocas llamadas.
 * Mucho más rápido que consultar activo por activo cuando se filtra por fotos.
 * Los archivos siguen el formato `${codigoActivo}_${timestamp}_${i}.${ext}`.
 * Usa caché en memoria (TTL 2 min) para no re-listar el bucket en cada búsqueda.
 */
let allPhotoCountsCache = { data: null, fetchedAt: 0 };
const PHOTO_COUNTS_TTL = 2 * 60 * 1000;

export const invalidatePhotoCountsCache = () => {
  allPhotoCountsCache = { data: null, fetchedAt: 0 };
};

export const fetchAllPhotoCounts = async ({ force = false } = {}) => {
  const now = Date.now();
  if (!force && allPhotoCountsCache.data && now - allPhotoCountsCache.fetchedAt < PHOTO_COUNTS_TTL) {
    return allPhotoCountsCache.data;
  }
  const counts = {};
  const PAGE = 1000;
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list("", { limit: PAGE, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    const list = data || [];
    list.forEach((f) => {
      if (isCotizacionFile(f?.name)) return;
      const code = String(f?.name || "").split("_")[0];
      if (!code) return;
      counts[code] = (counts[code] || 0) + 1;
    });
    if (list.length < PAGE) break;
    offset += PAGE;
  }
  allPhotoCountsCache = { data: counts, fetchedAt: Date.now() };
  return counts;
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

  const filtered = (data || []).filter(
    (f) => f.name.startsWith(prefix) && !isCotizacionFile(f.name)
  );

  // Obtener URLs públicas en lote para reducir llamadas API
  const filesWithUrls = await Promise.all(
    filtered.map((f) => supabase.storage.from(BUCKET_NAME).getPublicUrl(f.name))
  );

  return filtered.map((f, i) => ({
    name: f.name,
    url: filesWithUrls[i].data.publicUrl,
  }));
};

/**
 * Obtiene las fotos de respaldo de una subcolumna N° Cotización.
 * Bucket: `revaluo`. Solo estas columnas usan ese bucket.
 * Si cotIndex es null trae las 3 subcolumnas del activo.
 */
export const fetchCotizacionImages = async (codigoActivo, cotIndex = null) => {
  const prefix = `${codigoActivo}_`;
  const { data, error } = await supabase.storage
    .from(BUCKET_REVALUO)
    .list("", { search: prefix, sortBy: { column: "name", order: "asc" } });
  if (error) throw error;
  if (!data) return [];
  const marker = cotIndex != null ? `_COT${cotIndex}_` : "_COT";
  const filtered = (data || []).filter(
    (f) =>
      f.name.startsWith(prefix) &&
      String(f.name).toUpperCase().includes(marker)
  );
  const filesWithUrls = await Promise.all(
    filtered.map((f) => supabase.storage.from(BUCKET_REVALUO).getPublicUrl(f.name))
  );
  return filtered.map((f, i) => ({
    name: f.name,
    url: filesWithUrls[i].data.publicUrl,
    cotIndex: cotIndexFromFileName(f.name),
  }));
};

let cotizacionCountsCache = { data: null, fetchedAt: 0 };

export const invalidateCotizacionCountsCache = () => {
  cotizacionCountsCache = { data: null, fetchedAt: 0 };
};

/**
 * Conteo de fotos por activo + subcolumna. Clave: `${codigoActivo}_COT{n}`.
 * Bucket: `revaluo`.
 */
export const fetchAllCotizacionCounts = async ({ force = false } = {}) => {
  const now = Date.now();
  if (!force && cotizacionCountsCache.data && now - cotizacionCountsCache.fetchedAt < PHOTO_COUNTS_TTL) {
    return cotizacionCountsCache.data;
  }
  const counts = {};
  const PAGE = 1000;
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage
      .from(BUCKET_REVALUO)
      .list("", { limit: PAGE, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    const list = data || [];
    list.forEach((f) => {
      const idx = cotIndexFromFileName(f?.name);
      if (!idx) return;
      const code = String(f?.name || "").split("_")[0];
      if (!code) return;
      const key = `${code}_COT${idx}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    if (list.length < PAGE) break;
    offset += PAGE;
  }
  cotizacionCountsCache = { data: counts, fetchedAt: Date.now() };
  return counts;
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
  invalidatePhotoCountsCache();
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
  invalidatePhotoCountsCache();
  invalidateCotizacionCountsCache();
};

/**
 * Fotos de respaldo por subcolumna N° Cotización (1/2/3).
 * Formato: `${codigoActivo}_${EMPRESA}_COT{n}_${timestamp}_${i}.${ext}`
 * donde EMPRESA es el nombre escrito en la columna (sanitizado).
 * Varias fotos por columna: se diferencian por timestamp + índice.
 */
export const sanitizeEmpresaNombre = (raw) => {
  const base = String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);
  return base || "SIN_EMPRESA";
};

export const COT_MARKERS = ["_COT1_", "_COT2_", "_COT3_"];

export const isCotizacionFile = (fileName) =>
  String(fileName || "").toUpperCase().includes("_COT");

export const cotIndexFromFileName = (fileName) => {
  const upper = String(fileName || "").toUpperCase();
  const m = upper.match(/_COT([123])_/);
  return m ? Number(m[1]) : null;
};

export const buildCotizacionFileName = (codigoActivo, empresa, cotIndex, i, ext) => {
  const emp = sanitizeEmpresaNombre(empresa);
  return `${codigoActivo}_${emp}_COT${cotIndex}_${Date.now()}_${i}.${ext}`;
};

/**
 * Sube múltiples fotos de respaldo para una subcolumna N° Cotización.
 * Bucket: `revaluo` (solo estas columnas).
 */
export const uploadCotizacionImages = async (codigoActivo, empresa, cotIndex, files) => {
  if (!codigoActivo) throw new Error("Falta código de activo");
  if (![1, 2, 3].includes(Number(cotIndex))) throw new Error("Cotización inválida (1/2/3)");
  const list = Array.from(files || []);
  if (list.length === 0) return [];
  const uploadedNames = [];
  for (let i = 0; i < list.length; i++) {
    const file = list[i];
    const ext = (String(file.name || "").split(".").pop() || "jpg").toLowerCase().slice(0, 5);
    const fileName = buildCotizacionFileName(codigoActivo, empresa, cotIndex, i, ext);
    const { error } = await supabase.storage.from(BUCKET_REVALUO).upload(fileName, file);
    if (error) throw error;
    uploadedNames.push(fileName);
  }
  invalidateCotizacionCountsCache();
  return uploadedNames;
};

/**
 * Elimina una foto de respaldo de cotización (bucket `revaluo`).
 */
export const deleteCotizacionImage = async (fileName) => {
  const { error } = await supabase.storage
    .from(BUCKET_REVALUO)
    .remove([fileName]);
  if (error) throw error;
  invalidateCotizacionCountsCache();
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
