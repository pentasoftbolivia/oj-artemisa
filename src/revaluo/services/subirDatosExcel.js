import * as XLSX from "xlsx";

const normHeader = (s) =>
  String(s ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]/g, "");

/** Normaliza un código de activo para comparar Excel vs interfaz ("OJ-02-123" -> "123"). */
export const normCodigoActivo = (v) =>
  normHeader(v).replace(/^OJ0*2/, "");

const isCodigoActivoHeader = (h) => {
  const n = normHeader(h);
  return n.includes("CODIGO") && n.includes("ACTIVO");
};

const colIndexOf = (headers, re) => headers.findIndex((h) => re.test(normHeader(h)));

/**
 * Lee un ArrayBuffer de Excel y extrae por fila:
 * { codigo, c1, c2, c3, n1, n2, n3, u1, u2, u3 }
 * Columnas Excel: Codigo Activo | MERCADO 1/2/3 -> c1/c2/c3 | NOMBRE 1/2/3 -> n1/n2/n3
 * | URL 1/2/3 -> u1/u2/u3 (opcionales, no bloquean la carga).
 * El Promedio NO se guarda: la interfaz lo calcula como (c1+c2+c3)/3 (calcRow).
 */
export const parseCotizacionesExcel = (arrayBuffer) => {
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("El Excel no tiene hojas.");
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const headerIdx = rows.findIndex((r) =>
    Array.isArray(r) && r.some(isCodigoActivoHeader)
  );
  if (headerIdx === -1) {
    throw new Error(
      "No se encontró la columna 'Codigo Activo' en el Excel."
    );
  }
  const headers = rows[headerIdx];
  const idxCodigo = headers.findIndex(isCodigoActivoHeader);
  const idxM = [1, 2, 3].map((i) => colIndexOf(headers, new RegExp(`MERCADO0*${i}`)));
  const idxN = [1, 2, 3].map((i) => colIndexOf(headers, new RegExp(`NOMBRE0*${i}`)));
  const idxU = [1, 2, 3].map((i) => colIndexOf(headers, new RegExp(`^URL0*${i}$`)));

  const faltantes = [];
  idxM.forEach((ix, k) => { if (ix === -1) faltantes.push(`MERCADO ${k + 1}`); });
  idxN.forEach((ix, k) => { if (ix === -1) faltantes.push(`NOMBRE ${k + 1}`); });
  if (faltantes.length > 0) {
    throw new Error(`Faltan columnas en el Excel: ${faltantes.join(", ")}.`);
  }

  const out = [];
  let sinCodigo = 0;
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row) || row.every((c) => String(c ?? "").trim() === "")) continue;
    const codigo = normCodigoActivo(row[idxCodigo]);
    if (!codigo) { sinCodigo += 1; continue; }
    out.push({
      codigo,
      c: [idxM[0], idxM[1], idxM[2]].map((ix) => parseMonto(row[ix])),
      n: [idxN[0], idxN[1], idxN[2]].map((ix) => String(row[ix] ?? "").replace(/\s+/g, " ").trim()),
      u: [idxU[0], idxU[1], idxU[2]].map((ix) => (ix === -1 ? "" : String(row[ix] ?? "").trim())),
    });
  }
  return { items: out, sinCodigo };
};

/** Acepta "Bs 1.234,50" | "1234,50" | 1234.5 | 1234 -> number o null. */
export const parseMonto = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return isNaN(v) ? null : v;
  let s = String(v).trim().replace(/^Bs\.?\s*/i, "").replace(/\s+/g, "");
  if (s === "") return null;
  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",") && !s.includes(".")) {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
};
