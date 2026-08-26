import { supabase } from "@/lib/supabase";
import { invalidateCatalog } from "@/lib/catalogCache";

/**
 * Crea registro en act_transaccion y luego en act_activos.
 * KISS/DRY: lógica centralizada, sin duplicación, payloads explícitos.
 */
export const crearRegistroActivo = async ({
  codigoactivo,
  codigoambiente,
  cirun,
  descripcionactivo,
  valoractual,
  observaciones,
  tiporubroact,
  serie,
  marcamaterial,
  userEmail,
}) => {
  if (!codigoactivo) throw new Error("Código activo es requerido");
  if (!codigoambiente) throw new Error("Ambiente es requerido");
  if (!cirun) throw new Error("Responsable (CI) es requerido");
  if (!descripcionactivo?.trim()) throw new Error("Descripción es requerida");
  if (valoractual === "" || valoractual == null) throw new Error("Valor actual es requerido");
  if (!tiporubroact) throw new Error("Tipo de rubro es requerido");

  const codigoActivoNum = Number(String(codigoactivo).replace(/\D/g, ""));
  if (!codigoActivoNum) throw new Error("Código activo inválido");

  const valorActualNum = Number(valoractual);
  if (Number.isNaN(valorActualNum)) throw new Error("Valor actual inválido");

  const nowIso = new Date().toISOString();
  const email = userEmail || "system";

  // 1. Verificar que no exista activo con mismo codigoactivo y ultimoregistro=1
  const { data: existente, error: errExiste } = await supabase
    .from("act_activos")
    .select("codigoactivointerno")
    .eq("codigoactivo", codigoActivoNum)
    .eq("ultimoregistro", 1)
    .limit(1);
  if (errExiste) throw errExiste;
  if (existente && existente.length > 0) {
    throw new Error(`Ya existe un activo con código ${codigoActivoNum} (ultimoregistro=1)`);
  }

  // 2. Crear transacción (codigotransaccion es correlativo automático)
  const transaccionPayload = {
    codigoactivo: codigoActivoNum,
    codigosubtipotransaccion: 15,
    codigousuario: 1,
    fechatransaccion: nowIso,
    reponsabletransaccion: email,
    nrocite: "0",
    usuarioregistro: email,
    fecharegistro: nowIso,
    registroactivo: 1,
  };

  const { data: transaccion, error: errTrans } = await supabase
    .from("act_transaccion")
    .insert(transaccionPayload)
    .select("codigotransaccion")
    .single();

  if (errTrans) throw errTrans;
  const codigotransaccion = transaccion.codigotransaccion;
  if (!codigotransaccion) throw new Error("No se generó codigotransaccion");

  // 3. Crear activo fijo
  const activoPayload = {
    codigoactivo: codigoActivoNum,
    codigotransaccion,
    codigoambiente: String(codigoambiente).trim(),
    cirun: String(cirun).trim(),
    descripcionactivo: String(descripcionactivo).trim(),
    terreno: null,
    vehiculo: null,
    estado: 1,
    revaluo: 0,
    valorrevaluo: 0,
    valorinicial: 0,
    vidautilinicial: 0,
    valoractual: valorActualNum,
    vidutilactual: 0,
    resolucionamparo: "0",
    observaciones: String(observaciones || "").trim() || null,
    valornominal: 0,
    cal_actualizacionbs1: 0,
    cal_actualizacionbs2: 0,
    tiporubroact: Number(tiporubroact),
    idsssrubro: 0,
    codigounidad: "0",
    serie: String(serie || "").trim() || null,
    marcamaterial: String(marcamaterial || "").trim() || null,
    validado: 0,
    ultimoregistro: 1,
    fecharegistro: nowIso,
    registroactivo: 1,
    usuarioregistro: email,
    // campos numéricos restantes a 0 por especificación "todos los demás campos poner 0"
    tanjible: 0,
    incactgestion: 0,
    depges: 0,
    valorneto: 0,
    pordepanu: 0,
    valorinigest: 0,
    facgestion: 0,
    factotal: 0,
    vidutilcons: 0,
    vidutilconges: 0,
    vidutiltot: 0,
    vidutilrest: 0,
    tchoyufv: 0,
    tcgestionufv: 0,
    tccompraufv: 0,
    se_imprime: 0,
  };

  const { data: activo, error: errActivo } = await supabase
    .from("act_activos")
    .insert(activoPayload)
    .select("codigoactivointerno, codigoactivo, codigotransaccion")
    .single();

  if (errActivo) {
    // rollback transacción si falla activo (intento de limpieza)
    await supabase.from("act_transaccion").delete().eq("codigotransaccion", codigotransaccion);
    throw errActivo;
  }

  invalidateCatalog("act_activos");
  invalidateCatalog("act_transaccion");

  return { transaccion, activo };
};
