const BATCH_SIZE = 20;

const round2 = (v) => Number(Number(v).toFixed(2));

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
  for (let k = 0; k < pendientes.length; k += BATCH_SIZE) {
    const slice = pendientes.slice(k, k + BATCH_SIZE);
    const res = await Promise.allSettled(
      slice.map((p) =>
        supabase
          .from("act_activos")
          .update({ valorneto: round2(p.valorNeto) })
          .eq("codigoactivointerno", p.interno)
          .eq("ultimoregistro", 1)
      )
    );
    res.forEach((r, idx) => {
      if (r.status === "fulfilled" && !r.value?.error) actualizados += 1;
      else errores.push(slice[idx].interno);
    });
    onProgress?.(Math.min(k + BATCH_SIZE, pendientes.length), pendientes.length);
    await new Promise((r) => setTimeout(r, 0));
  }
  return {
    total: (items || []).length,
    pendientes: pendientes.length,
    actualizados,
    omitidos: (items || []).length - pendientes.length,
    errores,
  };
};
