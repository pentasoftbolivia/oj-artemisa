// Cálculo de fila de Revalúo compartido entre la tabla y el grabado en BD.
// Promedio = (c1+c2+c3)/3 · Factor Revalúo = Promedio × Años Asig. · Precio = FR / Años x tipo.

const parseNum = (v) => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? null : n;
};

// Clave de factor según estado: Ba si está de Baja, si no según conservación (B/R/M, por defecto B)
const factorKeyFor = (a) => {
  const estado = String(a.estado ?? a.estadoActivo ?? "").trim().toUpperCase();
  if (estado === "0" || estado === "FALSE" || estado === "BAJA") return "Ba";
  const c = String(a._estadoConservacion || "").trim().toUpperCase();
  if (c.startsWith("R")) return "R";
  if (c.startsWith("M")) return "M";
  return "B";
};

export const calcRow = (a, ws, factores) => {
  const nums = [ws.c1, ws.c2, ws.c3].map(parseNum).filter((n) => n !== null);
  const promedio = nums.length > 0 ? nums.reduce((s, n) => s + n, 0) / nums.length : null;
  const fkey = factorKeyFor(a);
  // Factor de la fila si está lleno, si no el global por defecto (solo referencial F.Años)
  const effFactor = (prefix) => {
    const row = parseNum(ws[`${prefix}${fkey}`]);
    if (row !== null) return row;
    return parseNum(factores?.[`${prefix}${fkey}`]);
  };
  const fa = effFactor("fa");
  const vidaRaw = a._vidaUtil != null && String(a._vidaUtil).trim() !== "" ? Number(a._vidaUtil) : null;
  const vida = vidaRaw !== null && !isNaN(vidaRaw) ? vidaRaw : null;
  const vidaTipoRaw = a._vidaTipo != null && String(a._vidaTipo).trim() !== "" ? Number(a._vidaTipo) : null;
  const vidaTipo = vidaTipoRaw !== null && !isNaN(vidaTipoRaw) ? vidaTipoRaw : null;
  // Años Asignados = vida útil según rubro y estado de conservación (cuadros).
  // Vacío si no hay valor en estadoconservacion de act_activos.
  const consRaw = String(a.estadoconservacion ?? a.estadoConservacion ?? "").trim();
  const anios = consRaw === "" ? null : vida;
  // Factor Revalúo = Promedio × Años Asig. (en la subcolumna del estado)
  const fr = promedio !== null && anios !== null
    ? promedio * anios
    : null;
  // Precio Revalúo = Factor Revalúo / Años x tipo
  const precio = fr !== null && vidaTipo !== null && vidaTipo !== 0 ? fr / vidaTipo : null;
  return { promedio, precio, anios, fkey, fr, fa, vida, vidaTipo };
};
