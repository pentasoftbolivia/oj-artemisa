export const normalizeKey = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

export const normalizarEstado = (estado) =>
  String(estado ?? "").trim().replace(/\s+/g, " ").toUpperCase();

export const RUBRO_ALIAS = {
  "equipo de oficina y muebles": "equipos de oficina y muebles",
  "equipos de comunicaciones": "equipos de comunicación",
  "equipos de comunicaciónes": "equipos de comunicación",
  "equipo de comunicaciones": "equipos de comunicación",
  "equipo de comunicaciónes": "equipos de comunicación",
  "equipo de comunicación": "equipos de comunicación",
  "equipo de computación": "equipos de computación",
  "equipo de computacion": "equipos de computación",
  "equipos de computacion": "equipos de computación",
  "maquinaria y equipos": "maquinaria y equipo",
  "maquinarias y equipo": "maquinaria y equipo",
  "maquinarias y equipos": "maquinaria y equipo",
  "maquinaria y equipo de produccion": "maquinaria y equipo",
  "maquinaria y equipo de producción": "maquinaria y equipo",
  "otro equipo y maquinaria": "otros equipos y maquinaria",
  "otros equipos y maquinarias": "otros equipos y maquinaria",
  "otro equipo y maquinarias": "otros equipos y maquinaria",
  "otro activo fijo": "otros activos fijos",
  "otros activo fijo": "otros activos fijos",
  "otro activos fijos": "otros activos fijos",
};

export const RUBRO_FIELDS_RAW = {
  "EQUIPO EDUCACIONAL Y RECREATIVO": [
    { key: "modelo", label: "Modelo" },
    { key: "capacidaddimension", label: "Capacidad/Dimensión" },
    { key: "fuentealimentacion", label: "Fuente de Alimentación" },
    { key: "accesorios", label: "Accesorios" },
  ],
  "EQUIPO DE TRANSPORTE, ELEVACIÓN Y TRACCIÓN": [
    { key: "numeromotor", label: "Número de Motor" },
    { key: "numerochasis", label: "Número de Chasis" },
    { key: "serial", label: "Serial" },
    { key: "placamatricula", label: "Placa Matrícula" },
    { key: "capacidadcargatraccion", label: "Capacidad de Carga/Tracción" },
  ],
  "EQUIPOS DE COMUNICACIÓN": [
    { key: "alcancecobertura", label: "Alcance y Cobertura" },
  ],
  "EQUIPOS DE OFICINA Y MUEBLES": [
    { key: "medidas", label: "Medidas" },
    { key: "color", label: "Color" },
    { key: "divisionescajonesbandejas", label: "Divisiones/Cajones/Bandejas" },
    { key: "chapa", label: "Chapa" },
    { key: "abatible", label: "Abatible" },
    { key: "deslizable", label: "Deslizable" },
  ],
  "EQUIPOS DE COMPUTACIÓN": [
    { key: "ram", label: "RAM" },
    { key: "procesador", label: "Procesador" },
    { key: "discoduro", label: "Disco Duro" },
  ],
  "MAQUINARIA Y EQUIPO": [
    { key: "potencia", label: "Potencia" },
    { key: "horometro", label: "Horómetro" },
    { key: "combustibleenergia", label: "Combustible/Energía" },
  ],
  "OTROS EQUIPOS Y MAQUINARIA": [
    { key: "potencia", label: "Potencia" },
    { key: "funcion", label: "Función" },
  ],
  "OTRA MAQUINARIA Y EQUIPO": [
    { key: "potencia", label: "Potencia" },
    { key: "funcion", label: "Función" },
  ],
  "OTROS ACTIVOS FIJOS": [
    { key: "categoria", label: "Categoría" },
    { key: "caracteristicas", label: "Características" },
  ],
};

const RUBRO_FIELDS = {};
Object.entries(RUBRO_FIELDS_RAW).forEach(([key, fields]) => {
  RUBRO_FIELDS[normalizeKey(key)] = fields;
});

export const getRubroFields = (rubroDesc) => {
  const key = RUBRO_ALIAS[normalizeKey(rubroDesc)] || normalizeKey(rubroDesc);
  return RUBRO_FIELDS[key] || [];
};

export const BASE_EDIT_FIELDS = [
  { key: "codigoActivo", label: "Código Activo", type: "text", readonly: true },
  { key: "rubro", label: "Rubro", type: "text", readonly: true },
  { key: "tipoRubro", label: "Tipo Rubro", type: "text", readonly: true },
  { key: "descripcionActivo", label: "Descripción del Activo", type: "text" },
  { key: "codigoAmbiente", label: "Ambiente", type: "select" },
];

export const normalizeCi = (v) => String(v ?? "").replace(/[^\d]/g, "");
export const normalizeCiLoose = (v) => normalizeCi(v).replace(/^0+/, "") || "0";
export const getCiPrefix = (ci) => String(ci ?? "").match(/^\d+/)?.[0] ?? "";
