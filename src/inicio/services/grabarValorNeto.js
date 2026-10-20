// Lotes pequeños y secuenciales: decenas de PATCH en paralelo saturan la
// red y Supabase responde con fallos que el navegador muestra como CORS
// (status null). 5 en paralelo + pausa + 1 reintento por lote.
const BATCH_SIZE = 5;
const BATCH_PAUSE_MS = 300;

const round2 = (v) => Number(Number(v).toFixed(4));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const isNetworkLike = (err) =>
  err instanceof TypeError ||
  /failed to fetch|networkerror|load failed|cors/i.test(String(err?.message || err || ""));

/**
 * Graba el Valor Neto calculado en act_activos.valorneto.
 * items: [{ interno (codigoactivointerno), valorNeto (calculado), actual (valorneto en BD) }]
 * Solo actualiza filas con valor calculado distinto al actual (redondeado a 2 dec).
 * No lanza: devuelve { total, actualizados, omitidos, errores }.
 */
export const grabarValorNeto = async (supabase, items, onProgress) => {
  const pendientes = (items || []).filter((it) => {
    if (it.interno == null || String(it.interno).trim() === "") return false;
    if (it.valorNeto === null || it.valorNeto === undefined) return false;
    if (it.actual !== null && it.actual !== undefined) {
      try {
        if (round2(it.valorNeto) === round2(it.actual)) return false;
      } catch {
        return true;
      }
    }
    return true;
  });
  let actualizados = 0;
  const errores = [];
  let firstErrorMsg = "";
  const doOne = (p) =>
    supabase
      .from("act_activos")
      .update({ valorneto: round2(p.valorNeto) })
      .eq("codigoactivointerno", p.interno)
      .eq("ultimoregistro", 1);
  for (let k = 0; k < pendientes.length; k += BATCH_SIZE) {
    const slice = pendientes.slice(k, k + BATCH_SIZE);
    const res = await Promise.allSettled(slice.map(doOne));
    // Reintento único para fallos de red/CORS (los 4xx/RLS no se reintentan).
    const retryIdx = [];
    res.forEach((r, idx) => {
      const err = r.status === "rejected" ? r.reason : r.value?.error;
      if (!err) return;
      if (!firstErrorMsg) firstErrorMsg = String(err?.message || err);
      if (isNetworkLike(err) || r.status === "rejected") retryIdx.push(idx);
    });
    if (retryIdx.length > 0) {
      await sleep(BATCH_PAUSE_MS);
      const res2 = await Promise.allSettled(retryIdx.map((i) => doOne(slice[i])));
      res2.forEach((r, j) => {
        const idx = retryIdx[j];
        const err = r.status === "rejected" ? r.reason : r.value?.error;
        if (!err) res[idx] = { status: "fulfilled", value: {} };
        else if (!firstErrorMsg) firstErrorMsg = String(err?.message || err);
      });
    }
    res.forEach((r, idx) => {
      const err = r.status === "rejected" ? r.reason : r.value?.error;
      if (!err) actualizados += 1;
      else errores.push(slice[idx].interno);
    });
    onProgress?.(Math.min(k + BATCH_SIZE, pendientes.length), pendientes.length);
    await sleep(BATCH_PAUSE_MS);
  }
  return {
    total: (items || []).length,
    pendientes: pendientes.length,
    actualizados,
    omitidos: (items || []).length - pendientes.length,
    errores,
    firstError: firstErrorMsg,
  };
};
