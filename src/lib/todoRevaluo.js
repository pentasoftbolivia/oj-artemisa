/**
 * Universo compartido del reporte "TODO REVALUO".
 *
 * Se usa tanto en "TODO REVALUO POR RUBRO" (useReporteEncontradosPorRubro)
 * como en "REVALUO 7 RUBROS" (revaluo7RubrosService), para que ambos reportes
 * cuenten exactamente los mismos activos por rubro.
 *
 * Los 3 grupos son:
 *  1. Activos vigentes encontrados (código <= 43753, no MALO).
 *  2. Activos en baja marcados para revalúo (no MALO).
 *  3. Activos nuevos (activonuevo = true).
 */
export const TODO_REVALUO_OR_FILTER = [
  "and(codigoactivo.lte.43753,artemisaaltabaja.eq.0,ultimoregistro.eq.1,esactivo.eq.true,estadoconservacion.neq.MALO)",
  "and(codigoactivo.lte.43753,artemisaaltabaja.eq.1,pararevaluo.eq.true,activonuevo.eq.false,estadoconservacion.neq.MALO)",
  "activonuevo.eq.true",
].join(",");

export const matchesTodoRevaluo = (a) => {
  if (!a) return false;

  const codigoActivo = Number(a.codigoActivo ?? a.codigoactivo ?? 0);
  const estInv = String(a.estadoinventario ?? a.estadoInventario ?? "").trim();
  const tieneEstInv = estInv !== "";
  const esUltimo = String(a.ultimoregistro ?? a.ultimoRegistro ?? "").trim() === "1";
  const artemisa = Number(a.artemisaaltabaja ?? a.artemisaAltaBaja ?? NaN);

  const esActivoRaw = a.esactivo ?? a.esActivo;
  const esActivo =
    esActivoRaw === true ||
    String(esActivoRaw).trim().toUpperCase() === "TRUE" ||
    Number(esActivoRaw) === 1;

  const pararevaluoRaw = a.pararevaluo ?? a.paraRevaluo;
  const esParaRevaluo =
    pararevaluoRaw === true ||
    String(pararevaluoRaw).trim().toUpperCase() === "TRUE" ||
    Number(pararevaluoRaw) === 1;

  const activoNuevoRaw = a.activonuevo ?? a.activoNuevo;
  const esActivoNuevo =
    activoNuevoRaw === true ||
    String(activoNuevoRaw).trim().toUpperCase() === "TRUE" ||
    Number(activoNuevoRaw) === 1;

  const esMalo =
    String(a.estadoconservacion ?? a.estadoConservacion ?? "").trim().toUpperCase() === "MALO";

  const grupo1 =
    codigoActivo <= 43753 && tieneEstInv && artemisa === 0 && esUltimo && esActivo && !esMalo;
  const grupo2 =
    codigoActivo <= 43753 && tieneEstInv && artemisa === 1 && esParaRevaluo && !esActivoNuevo && !esMalo;
  const grupo3 = esActivoNuevo;

  return grupo1 || grupo2 || grupo3;
};
