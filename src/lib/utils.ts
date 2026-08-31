import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function createLookupMap<T extends Record<string, unknown>>(
  array: T[],
  keyField: keyof T,
  valueFormatter?: ((item: T) => unknown) | null
): Record<string, T | unknown> {
  if (!Array.isArray(array)) return {}
  return array.reduce((acc, item) => {
    const key = String(item[keyField])
    acc[key] = typeof valueFormatter === "function" ? valueFormatter(item) : item
    return acc
  }, {} as Record<string, T | unknown>)
}

export function createOptionsList<T extends Record<string, unknown>>(
  array: T[],
  valueKey: keyof T,
  labelFormatter: ((item: T) => string) | keyof T
): { value: string; label: string }[] {
  if (!Array.isArray(array)) return []
  return array.map((item) => ({
    value: String(item[valueKey] ?? ""),
    label:
      typeof labelFormatter === "function"
        ? labelFormatter(item)
        : String(item[labelFormatter] ?? item),
  }))
}

const sanitizeText = (s: unknown): string =>
  String(s ?? "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const buildDenominacion = (activo: Record<string, unknown>, rubroName: string): string => {
  let baseText = sanitizeText((activo.descripcionActivo as string) || "");
  if (!rubroName) return baseText;

  const valid = (val: unknown) => {
    if (val === null || val === undefined) return false;
    const str = sanitizeText(String(val));
    if (str === "" || str === "0") return false;
    return true;
  };

  const fieldsToConcat: string[] = [];
  const getVal = (obj: Record<string, unknown>, key: string) => {
    if (key in obj) return obj[key];
    const lower = key.toLowerCase();
    const found = Object.keys(obj).find((k) => k.toLowerCase() === lower);
    return found ? obj[found] : undefined;
  };
  const add = (key: string, prefix: string = "") => {
    const val = getVal(activo, key);
    if (valid(val)) {
      const strVal = sanitizeText(String(val));
      fieldsToConcat.push(`${prefix}${strVal}`);
    }
  };

  const rn = rubroName.toUpperCase();
  if (rn.includes("EQUIPO EDUCACIONAL Y RECREATIVO")) {
    add("modelo", "MOD: "); add("capacidaddimension", "CAPACIDAD/DIMENSIÓN: "); add("fuentealimentacion", "FUENTE ALIM: "); add("accesorios", "ACCESORIOS: ");
  } else if (rn.includes("EQUIPOS DE TRANSPORTE") || rn.includes("EQUIPO DE TRANSPORTE, ELEVACIÓN Y TRACCIÓN") || rn.includes("EQUIPO DE TRANSPORTE")) {
    add("marcaMaterial", "MARCA: "); add("modelo", "MOD: "); add("serie", "S/N: "); add("numeromotor", "MOTOR: "); add("numerochasisserial", "CHASIS: "); add("placamatricula", "PLACA: "); add("capacidadcargatraccion", "CAPACIDAD CARGA: ");
  } else if (rn.includes("EQUIPO DE COMUNICAC") || rn.includes("EQUIPOS DE COMUNICAC")) {
    add("marcaMaterial", "MARCA: "); add("modelo", "MOD: "); add("serie", "S/N: "); add("alcancecobertura", "ALCANCE: ");
  } else if (rn.includes("EQUIPO DE OFICINA") || rn.includes("EQUIPOS DE OFICINA")) {
    add("marcaMaterial", "MARCA: "); add("modelo", "MOD: "); add("serie", "S/N: "); add("medidas", "MEDIDAS: "); add("color", "COLOR: "); add("divisionescajonesbandejas", "DIVISIONES: "); add("chapa", "CHAPA: "); add("abatible", "ABATIBLE: "); add("deslizable", "DESLIZABLE: "); add("caracteristicas", "CARACTERÍSTICAS: "); add("categoria", "CATEGORÍA: ");
  } else if (rn.includes("EQUIPO DE COMPUTAC") || rn.includes("EQUIPOS DE COMPUTAC")) {
    add("marcaMaterial", "MARCA: "); add("modelo", "MOD: "); add("serie", "S/N: "); add("ram", "RAM: "); add("procesador", "CPU: "); add("discoduro", "HDD/SSD: ");
  } else if (rn.includes("OTRA MAQUINARIA Y EQUIPO")) {
    add("marcaMaterial", "MARCA: "); add("modelo", "MOD: "); add("serie", "S/N: "); add("potencia", "POTENCIA: "); add("funcion", "FUNCIÓN: ");
  } else if (rn === "MAQUINARIA Y EQUIPO" || rn.includes("MAQUINARIA Y EQUIPO")) {
    if (rn.includes("OTROS EQUIPOS")) {
      add("potencia", "POTENCIA: "); add("funcion", "FUNCIÓN: ");
    } else {
      add("potencia", "POTENCIA: "); add("horometro", "HORÓMETRO: "); add("combustibleenergia", "COMBUSTIBLE: ");
    }
  } else if (rn.includes("OTROS EQUIPOS Y MAQUINARIA")) {
    add("potencia", "POTENCIA: "); add("funcion", "FUNCIÓN: ");
  } else if (rn.includes("OTROS ACTIVOS FIJOS")) {
    add("categoria", "CATEGORÍA: "); add("caracteristicas", "CARACTERÍSTICAS: ");
  }

  if (fieldsToConcat.length > 0) {
    baseText += ", " + fieldsToConcat.join(", ");
  }

  return baseText;
};
