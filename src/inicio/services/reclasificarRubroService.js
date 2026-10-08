import { supabase } from "@/lib/supabase";
import { getCachedCatalog } from "@/lib/catalogCache";
import { toCamelCaseArray } from "@/lib/mapFields";
import { ACTIVO_COLUMNS } from "@/lib/activoColumns";

const normDesc = (s) => String(s ?? "").trim().replace(/\s+/g, " ").toUpperCase();
const clean = (v) => String(v ?? "").replace(/\s+/g, " ").trim() || "—";

/**
 * Construye el mapa de reclasificación:
 * - Agrupa act_tiporubro por descripción normalizada.
 * - Solo grupos con >1 código (ambiguos).
 * - Canónico = tipo con más vigentes (ultimoregistro=1); empate: menor código.
 * - A reclasificar = activos vigentes con tipo no canónico dentro de esos grupos.
 * Retorna { grupos, items, totalVigentes } donde cada item trae
 * { activo, tipoActual, rubroActual, tipoDestino, rubroDestino }.
 */
export const buildReclasificarData = ({ tipos = [], rubros = [], activosVigentes = [], ubicacionPartsMap = {} }) => {
  const rubroDescByCod = {};
  (rubros || []).forEach((r) => {
    rubroDescByCod[r.codigorubroact] = r.descripcionrubroact;
    rubroDescByCod[String(r.codigorubroact)] = r.descripcionrubroact;
  });
  const tipoInfo = {};
  (tipos || []).forEach((t) => {
    const key = String(t.tiporubroact);
    tipoInfo[key] = {
      codigo: t.tiporubroact,
      descripcion: clean(t.descripciontiporubroact),
      codRubro: t.codigorubroact,
      rubro: clean(rubroDescByCod[t.codigorubroact] ?? rubroDescByCod[String(t.codigorubroact)]),
    };
  });

  // Conteo de vigentes por tipo
  const countByTipo = {};
  (activosVigentes || []).forEach((a) => {
    const k = String(a.tipoRubroAct ?? "");
    if (!k) return;
    countByTipo[k] = (countByTipo[k] || 0) + 1;
  });

  // Grupos ambiguos
  const byDesc = {};
  (tipos || []).forEach((t) => {
    const d = normDesc(t.descripciontiporubroact);
    if (!d) return;
    if (!byDesc[d]) byDesc[d] = [];
    byDesc[d].push(String(t.tiporubroact));
  });

  const grupos = [];
  Object.entries(byDesc).forEach(([desc, codigos]) => {
    const uniq = [...new Set(codigos)];
    if (uniq.length < 2) return;
    const ordenados = uniq
      .map((c) => ({ codigo: c, n: countByTipo[c] || 0 }))
      .sort((a, b) => b.n - a.n || Number(a.codigo) - Number(b.codigo));
    const canonico = ordenados[0].codigo;
    const aReclasificar = ordenados.slice(1).map((o) => o.codigo);
    const totalGrupo = ordenados.reduce((s, o) => s + o.n, 0);
    if (totalGrupo === 0) return;
    grupos.push({
      descripcion: desc,
      canonico,
      rubroDestino: tipoInfo[canonico]?.rubro || "—",
      detalle: ordenados.map((o) => ({
        tipo: o.codigo,
        rubro: tipoInfo[o.codigo]?.rubro || "—",
        vigentes: o.n,
        esDestino: o.codigo === canonico,
      })),
      aReclasificar,
    });
  });
  grupos.sort((a, b) => b.detalle.reduce((s, d) => s + (d.esDestino ? 0 : d.vigentes), 0) - a.detalle.reduce((s, d) => s + (d.esDestino ? 0 : d.vigentes), 0));

  const setReclasificar = new Set();
  grupos.forEach((g) => g.aReclasificar.forEach((c) => setReclasificar.add(c)));

  const items = [];
  (activosVigentes || []).forEach((a) => {
    const k = String(a.tipoRubroAct ?? "");
    if (!setReclasificar.has(k)) return;
    const actual = tipoInfo[k] || { codigo: k, descripcion: "—", rubro: "—" };
    const desc = normDesc(tipoInfo[k]?.descripcion);
    const g = grupos.find((x) => x.descripcion === desc);
    const destCod = g?.canonico ?? k;
    const destino = tipoInfo[destCod] || actual;
    const ambCode = String(a.codigoAmbiente ?? "").trim();
    const parts = ubicacionPartsMap[ambCode];
    items.push({
      codigoActivo: a.codigoActivo,
      descripcionActivo: clean(a.descripcionActivo ?? a.descripcionactivo),
      tipoActual: k,
      tipoActualDesc: actual.descripcion,
      rubroActual: actual.rubro,
      tipoDestino: String(destino.codigo),
      tipoDestinoDesc: destino.descripcion,
      rubroDestino: destino.rubro,
      ciudad: clean(parts?.ciudad),
      inmueble: clean(parts?.inmueble),
      nivel: clean(parts?.nivel),
      ambiente: clean(parts?.ambiente || ambCode),
      estadoInventario: String(a.estadoinventario ?? a.estadoInventario ?? "").trim() || "—",
      codigoInterno: a.codigoActivoInterno ?? a.codigoactivointerno ?? "",
    });
  });

  const sortByCodigo = (x, y) => {
    const cmp = String(x.rubroDestino || "").localeCompare(String(y.rubroDestino || ""), "es");
    if (cmp !== 0) return cmp;
    const nA = Number(String(x.codigoActivo ?? "").replace(/\D/g, ""));
    const nB = Number(String(y.codigoActivo ?? "").replace(/\D/g, ""));
    if (nA && nB && nA !== nB) return nA - nB;
    return String(x.codigoActivo ?? "").localeCompare(String(y.codigoActivo ?? ""), "es", { numeric: true });
  };
  items.sort(sortByCodigo);

  return { grupos, items, totalVigentes: (activosVigentes || []).length };
};

export const fetchReclasificarPayload = async () => {
  const [rubros, tipoRubros, ambientes, ciudades, inmuebles, niveles] = await Promise.all([
    getCachedCatalog("act_rubro"),
    getCachedCatalog("act_tiporubro"),
    getCachedCatalog("act_ambiente"),
    getCachedCatalog("act_ciudad"),
    getCachedCatalog("act_inmueble"),
    getCachedCatalog("act_nivel"),
  ]);

  const nivelMap = {};
  (niveles || []).forEach((n) => { nivelMap[String(n.codigonivel ?? "").trim()] = n; });
  const inmuebleMap = {};
  (inmuebles || []).forEach((i) => { inmuebleMap[String(i.codigoinmueble ?? "").trim()] = i; });
  const ciudadMap = {};
  (ciudades || []).forEach((c) => { ciudadMap[String(c.codigociudad ?? "").trim()] = c; });
  const ubicacionPartsMap = {};
  (ambientes || []).forEach((a) => {
    const code = String(a.codigoambiente ?? "").trim();
    if (!code) return;
    const nivel = nivelMap[String(a.codigonivel ?? "").trim()];
    const inmueble = nivel ? inmuebleMap[String(nivel.codigoinmueble ?? "").trim()] : null;
    const ciudad = inmueble ? ciudadMap[String(inmueble.codigociudad ?? "").trim()] : null;
    ubicacionPartsMap[code] = {
      ciudad: String(ciudad?.descripcion ?? "").trim() || "—",
      inmueble: String(inmueble?.inmueble ?? "").trim() || "—",
      nivel: String(nivel?.nivel ?? "").trim() || "—",
      ambiente: String(a.ambiente ?? "").trim() || "—",
    };
  });

  // Solo vigentes: son los que se van a reclasificar
  let activosVigentes = [];
  let from = 0;
  const FETCH_CHUNK = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from("act_activos")
      .select(ACTIVO_COLUMNS)
      .eq("ultimoregistro", 1)
      .order("codigoactivointerno", { ascending: true })
      .range(from, from + FETCH_CHUNK - 1);
    if (error) throw error;
    const batch = toCamelCaseArray(data || []);
    if (batch.length === 0) break;
    activosVigentes = activosVigentes.concat(batch);
    if (batch.length < FETCH_CHUNK) break;
    from += FETCH_CHUNK;
    if (activosVigentes.length > 60000) break;
    await new Promise((r) => setTimeout(r, 0));
  }

  return { rubros, tipoRubros, ubicacionPartsMap, ...buildReclasificarData({ tipos: tipoRubros, rubros, activosVigentes, ubicacionPartsMap }) };
};
