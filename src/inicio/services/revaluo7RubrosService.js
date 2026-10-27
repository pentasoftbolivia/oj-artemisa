import { supabase } from "@/lib/supabase";
import { getCachedCatalog } from "@/lib/catalogCache";
import { toCamelCaseArray } from "@/lib/mapFields";
import { ACTIVO_COLUMNS } from "@/lib/activoColumns";
import { buildVidaUtilPorRubro, resolveAniosAsignados } from "@/lib/aniosAsignados";
import { TODO_REVALUO_OR_FILTER, matchesTodoRevaluo } from "@/lib/todoRevaluo";

// Fecha oficial de revalúo que se imprime en el reporte.
export const FECHA_REVALUO = "09/10/2026";

const norm = (value) =>
  String(value ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Los 7 rubros del proyecto de revalúo (los mismos que trae revaluo4.xlsx).
 * `test` se aplica sobre el nombre del rubro normalizado (sin acentos, mayúsculas).
 * El orden es el que se usará para las 7 pestañas del Excel y las secciones del PDF.
 *
 * El universo de activos es exactamente el mismo del reporte
 * "TODO REVALUO POR RUBRO", por lo que el total y el conteo por rubro
 * coinciden con su columna "Activos".
 */
export const REVALUO_7_RUBROS = [
  { key: "comunicaciones", label: "EQUIPO DE COMUNICACIONES", sheetName: "EQUIPO DE COMUNICACIONES", test: /COMUNICACION/ },
  { key: "oficina", label: "EQUIPO DE OFICINA Y MUEBLES", sheetName: "EQUIPO DE OFICINA Y MUEBLES", test: /OFICINA/ },
  { key: "educacional", label: "EQUIPO EDUCACIONAL Y RECREATIVO", sheetName: "EQUIPO EDUCACIONAL", test: /EDUCACIONAL/ },
  { key: "computacion", label: "EQUIPOS DE COMPUTACION", sheetName: "EQUIPOS DE COMPUTACION", test: /COMPUTACION/ },
  { key: "transporte", label: "EQUIPOS DE TRANSPORTE TRACCION Y ELEVACION", sheetName: "EQUIPOS DE TRANSPORTE", test: /TRANSPORTE|TRACCION|ELEVACION/ },
  { key: "otraMaquinaria", label: "OTRA MAQUINARIA Y EQUIPO", sheetName: "OTRA MAQUINARIA Y EQUIPO", test: /OTRA MAQUINARIA/ },
  { key: "otrosActivos", label: "OTROS ACTIVOS FIJOS", sheetName: "OTROS ACTIVOS FIJOS", test: /OTROS ACTIVOS FIJOS/ },
];

export const REVALUO_7_RUBROS_HEADERS = [
  "N°",
  "Código Activo",
  "Descripción",
  "Propuesta de descripción del Bien",
  "Rubro Contable",
  "Valor en Libros",
  "Nuevo Valor",
  "Nueva vida Útil",
  "Estado del Bien",
  "Observación y/o Recomendación",
  "Fecha de Revalúo",
];

export const matchRevaluoRubro = (rubroDesc) => {
  const rubro = norm(rubroDesc);
  if (!rubro) return null;
  return REVALUO_7_RUBROS.find((grupo) => grupo.test.test(rubro)) ?? null;
};

const parseNum = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const FETCH_CHUNK = 1000;

const fetchRevaluoActivos = async () => {
  let rows = [];
  let from = 0;

  while (true) {
    // Universo idéntico al reporte TODO REVALUO POR RUBRO (3 grupos de revalúo).
    // Se reutiliza el mismo filtro OR y el mismo filtro en memoria para que el
    // total y el conteo por rubro coincidan exactamente con ese reporte.
    const { data, error } = await supabase
      .from("act_activos")
      .select(`${ACTIVO_COLUMNS},esactivo,activonuevo,artemisaaltabaja,valorrevaluo,saldoinicial_exp,depacum_exp`)
      .or(TODO_REVALUO_OR_FILTER)
      .order("codigoactivointerno", { ascending: true })
      .range(from, from + FETCH_CHUNK - 1);

    if (error) throw error;

    const batch = toCamelCaseArray(data || []);
    if (batch.length === 0) break;

    rows = rows.concat(batch);
    if (batch.length < FETCH_CHUNK) break;

    from += FETCH_CHUNK;
    if (rows.length > 100000) break;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  // Mismo criterio final que useReporteEncontradosPorRubro (todoRevaluo).
  return rows.filter(matchesTodoRevaluo);
};

/**
 * Carga los activos del universo "TODO REVALUO" y los reparte en los 7 rubros.
 * Devuelve siempre las 7 agrupaciones (aunque queden sin registros) para que
 * el Excel tenga las 7 pestañas y el PDF las 7 secciones.
 */
export const loadRevaluo7Rubros = async () => {
  const [rubros, tipoRubros] = await Promise.all([
    getCachedCatalog("act_rubro"),
    getCachedCatalog("act_tiporubro"),
  ]);

  const rubroDescMap = {};
  (rubros || []).forEach((rubro) => {
    rubroDescMap[rubro.codigorubroact] = rubro.descripcionrubroact;
    rubroDescMap[String(rubro.codigorubroact)] = rubro.descripcionrubroact;
  });

  const rubroFromTipo = {};
  (tipoRubros || []).forEach((tipo) => {
    rubroFromTipo[tipo.tiporubroact] = rubroDescMap[tipo.codigorubroact];
    rubroFromTipo[String(tipo.tiporubroact)] = rubroDescMap[tipo.codigorubroact];
  });

  const vidaUtilPorRubro = buildVidaUtilPorRubro(rubros);
  const activos = await fetchRevaluoActivos();

  const grupos = REVALUO_7_RUBROS.map((grupo) => ({ ...grupo, rows: [] }));
  const sinClasificar = new Map();

  activos.forEach((activo) => {
    const tipoRubroAct = activo.tipoRubroAct ?? activo.tiporubroact;
    const rubroDesc = rubroFromTipo[tipoRubroAct] ?? rubroFromTipo[String(tipoRubroAct)] ?? "";
    const grupo = matchRevaluoRubro(rubroDesc);
    if (!grupo) {
      // Si un activo del universo TODO REVALUO no cae en los 7 rubros se
      // registra para no perderlo en silencio (no debería ocurrir con los 2106).
      const key = String(rubroDesc || "SIN RUBRO").trim();
      sinClasificar.set(key, (sinClasificar.get(key) ?? 0) + 1);
      return;
    }

    const saldoInicial = parseNum(activo.saldoInicialExp ?? activo.saldoinicial_exp);
    const depAcum = parseNum(activo.depAcumExp ?? activo.depacum_exp);
    const valorEnLibros = saldoInicial !== null && depAcum !== null ? saldoInicial - depAcum : null;
    const nuevoValor = parseNum(activo.valorRevaluo ?? activo.valorrevaluo);
    const estadoConservacion = String(activo.estadoconservacion ?? activo.estadoConservacion ?? "").trim();

    grupos.find((g) => g.key === grupo.key).rows.push({
      codigoActivo: activo.codigoActivo ?? activo.codigoactivo,
      descripcion: String(activo.descripcionActivo ?? activo.descripcionactivo ?? "").trim(),
      propuestaDescripcion: "",
      rubroContable: String(rubroDesc || grupo.label).trim(),
      valorEnLibros,
      nuevoValor,
      nuevaVidaUtil: resolveAniosAsignados(rubroDesc, estadoConservacion, vidaUtilPorRubro),
      estadoBien: estadoConservacion,
      observacion: String(activo.observaciones ?? "").trim(),
      fechaRevaluo: FECHA_REVALUO,
    });
  });

  grupos.forEach((grupo) => {
    grupo.rows.sort((a, b) => {
      const ca = Number(a.codigoActivo);
      const cb = Number(b.codigoActivo);
      if (Number.isFinite(ca) && Number.isFinite(cb)) return ca - cb;
      return String(a.codigoActivo ?? "").localeCompare(String(b.codigoActivo ?? ""), "es");
    });
    grupo.rows = grupo.rows.map((row, index) => ({ ...row, n: index + 1 }));
  });

  if (sinClasificar.size > 0) {
    console.warn(
      "[Revaluo 7 Rubros] Activos del universo TODO REVALUO sin rubro de los 7:",
      Object.fromEntries(sinClasificar)
    );
  }

  return {
    grupos,
    total: grupos.reduce((sum, grupo) => sum + grupo.rows.length, 0),
    sinClasificar: Object.fromEntries(sinClasificar),
  };
};

export const formatRevaluoMoney = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
