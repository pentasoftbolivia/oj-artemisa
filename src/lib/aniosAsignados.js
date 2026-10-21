const norm = (value) =>
  String(value ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const OFICINA_ANOS = { NUEVO: 10, BUENO: 6, REGULAR: 3, MALO: 0 };
const COM_EDU_ANOS = { NUEVO: 8, BUENO: 6, REGULAR: 4, MALO: 0 };
const COMPU_ANOS = { NUEVO: 4, BUENO: 3, REGULAR: 2, MALO: 0 };
const TRANS_MAQ_ANOS = { NUEVO: 5, BUENO: 3, REGULAR: 2, MALO: 0 };

const ANOS_POR_RUBRO = [
  [/COMUNICACION/, 4],
  [/OFICINA/, 10],
  [/EDUCACIONAL/, 8],
  [/COMPUTACION/, 4],
  [/TRANSPORTE|TRACCION|ELEVACION/, 5],
  [/OTRA MAQUINARIA/, 8],
  [/MAQUINARIA/, 5],
  [/OTROS ACTIVOS FIJOS/, 8],
];

const vidaUtilBase = (rubroDesc, vidautil) => {
  const rubro = norm(rubroDesc);
  const match = ANOS_POR_RUBRO.find(([re]) => re.test(rubro));
  if (match) return match[1];
  if (vidautil !== null && vidautil !== undefined && String(vidautil).trim() !== "") {
    const value = Number(vidautil);
    return Number.isFinite(value) ? value : null;
  }
  return null;
};

export const buildVidaUtilPorRubro = (rubros) => {
  const map = {};
  (rubros || []).forEach((rubro) => {
    const descripcion = String(rubro?.descripcionrubroact ?? "").trim();
    if (!descripcion) return;
    map[descripcion] = vidaUtilBase(descripcion, rubro?.vidautil);
  });
  return map;
};

export const resolveAniosAsignados = (rubroDesc, estadoConservacion, baseMap = {}) => {
  const estadoRaw = String(estadoConservacion ?? "").trim();
  if (!estadoRaw) return null;

  const estado = estadoRaw.toUpperCase();
  const rubro = norm(rubroDesc);

  if (rubro.includes("OFICINA")) return OFICINA_ANOS[estado] ?? 10;
  if (rubro.includes("COMUNICACION") || rubro.includes("EDUCACIONAL")) return COM_EDU_ANOS[estado] ?? 8;
  if (rubro.includes("COMPUTACION")) return COMPU_ANOS[estado] ?? 4;
  if (rubro.includes("TRANSPORTE") || rubro.includes("TRACCION") || rubro.includes("ELEVACION") || rubro.includes("MAQUINARIA")) {
    return TRANS_MAQ_ANOS[estado] ?? 5;
  }

  const base = baseMap[String(rubroDesc ?? "").trim()];
  return base !== null && base !== undefined && Number.isFinite(Number(base)) ? Number(base) : null;
};
