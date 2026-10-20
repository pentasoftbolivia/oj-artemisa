/**
 * Extrae los activos cuyo rubro es TERRENOS, BIBLIOTECA o EDIFICACIONES
 * y los guarda en un Excel (una hoja por rubro + fila completa de cada activo).
 *
 * Por defecto aplica el criterio del reporte: ultimoregistro=1 y estado=1.
 * Con --todos exporta sin esos filtros (incluye históricos y bajas).
 *
 * La base exige usuario autenticado (RLS), por eso el script inicia sesión.
 *
 * Uso:
 *   node scripts/extraer-rubros-excluidos.mjs <email> <password> [archivo-salida.xlsx] [--todos]
 *
 * Ejemplo:
 *   node scripts/extraer-rubros-excluidos.mjs javiercostasaliaga@gmail.com MiClave123
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Lee VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY del .env (sin dependencias extra)
const loadEnv = () => {
  const envPath = path.join(ROOT, ".env");
  const out = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*("?)(.*?)\2\s*$/);
    if (m) out[m[1]] = m[3];
  }
  return out;
};

const norm = (s) =>
  String(s || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const RUBROS_OBJETIVO = ["TERRENO", "BIBLIOTEC", "EDIFICAC"];

const main = async () => {
  const args = process.argv.slice(2).filter((a) => a !== "--todos");
  const soloVigentes = !process.argv.includes("--todos");
  const [email, password, outArg] = args;
  if (!email || !password) {
    console.error("Uso: node scripts/extraer-rubros-excluidos.mjs <email> <password> [salida.xlsx] [--todos]");
    process.exit(1);
  }
  console.log(soloVigentes
    ? "Criterio: ultimoregistro=1 y estado=1 (use --todos para todo sin filtrar)"
    : "Criterio: todos los registros (sin filtrar ultimoregistro/estado)");

  const env = loadEnv();
  const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

  console.log("Iniciando sesión...");
  const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) throw new Error(`Login fallido: ${authError.message}`);

  // 1) Rubros: códigos de TERRENOS, BIBLIOTECA y EDIFICACIONES
  const { data: rubros, error: rubError } = await supabase
    .from("act_rubro")
    .select("codigorubroact, descripcionrubroact, vidautil")
    .order("descripcionrubroact");
  if (rubError) throw rubError;
  const objetivo = (rubros || []).filter((r) =>
    RUBROS_OBJETIVO.some((k) => norm(r.descripcionrubroact).includes(k))
  );
  console.log("\nCÓDIGOS DE RUBRO:");
  objetivo.forEach((r) =>
    console.log(`  ${r.codigorubroact}  ->  ${r.descripcionrubroact}`)
  );
  if (objetivo.length === 0) {
    console.log("No se encontraron esos rubros en act_rubro. Fin.");
    process.exit(0);
  }
  const codigosRubro = new Set(objetivo.map((r) => String(r.codigorubroact)));

  // 2) Tipos de rubro que pertenecen a esos rubros
  const tipos = [];
  {
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("act_tiporubro")
        .select("tiporubroact, descripciontiporubroact, codigorubroact")
        .range(from, from + 999);
      if (error) throw error;
      if (!data || data.length === 0) break;
      tipos.push(...data);
      if (data.length < 1000) break;
      from += 1000;
    }
  }
  const tiposObjetivo = tipos.filter((t) => codigosRubro.has(String(t.codigorubroact)));
  const codigosTipo = new Set(tiposObjetivo.map((t) => String(t.tiporubroact)));
  console.log(`\nTipos de rubro incluidos: ${codigosTipo.size}`);

  // 3) Activos de esos tipos (paginado; trae la fila completa)
  const activos = [];
  {
    let from = 0;
    for (;;) {
      let query = supabase.from("act_activos").select("*");
      if (soloVigentes) query = query.eq("ultimoregistro", 1).eq("estado", 1);
      const { data, error } = await query.range(from, from + 999);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const a of data) {
        if (!codigosTipo.has(String(a.tiporubroact))) continue;
        if (soloVigentes) {
          if (String(a.ultimoregistro ?? "").trim() !== "1") continue;
          const est = String(a.estado ?? "").trim().toUpperCase();
          if (est !== "1" && est !== "TRUE" && est !== "ALTA") continue;
        }
        activos.push(a);
      }
      process.stdout.write(`\rRevisados: ${from + data.length} | Coinciden: ${activos.length}`);
      if (data.length < 1000) break;
      from += 1000;
    }
  }
  console.log(`\n\nTotal activos en TERRENOS/BIBLIOTECA/EDIFICACIONES: ${activos.length}`);
  if (activos.length === 0) process.exit(0);

  // 4) Excel: una hoja por rubro
  const rubroDesc = Object.fromEntries(
    (rubros || []).map((r) => [String(r.codigorubroact), r.descripcionrubroact])
  );
  const tipoRubro = Object.fromEntries(
    tipos.map((t) => [String(t.tiporubroact), String(t.codigorubroact)])
  );
  const wb = XLSX.utils.book_new();
  for (const r of objetivo) {
    const code = String(r.codigorubroact);
    const lista = activos.filter(
      (a) => tipoRubro[String(a.tiporubroact)] === code
    );
    const ws = XLSX.utils.json_to_sheet(lista);
    ws["!cols"] = Object.keys(lista[0] || {}).map(() => ({ wch: 20 }));
    const sheetName = String(r.descripcionrubroact).slice(0, 28) || `Rubro_${code}`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    console.log(`  Hoja "${sheetName}": ${lista.length} activos`);
  }
  const dateStr = new Date().toISOString().slice(0, 10);
  const outFile = outArg || `activos_terrenos_biblioteca_edificaciones_${dateStr}.xlsx`;
  XLSX.writeFile(wb, path.resolve(ROOT, outFile));
  console.log(`\nArchivo generado: ${outFile}`);
};

main().catch((err) => {
  console.error(`\nERROR: ${err.message}`);
  process.exit(1);
});
