import pg from "pg";

const { Pool } = pg;

const POOL_HOST = process.env.PG_HOST || "aws-0-sa-east-1.pooler.supabase.com";
const POOL_PORT = Number(process.env.PG_PORT || 6543);
const POOL_USER = process.env.PG_USER || "postgres.ydmrafgtxkhfyhjkbnsf";
const POOL_PASSWORD = process.env.PG_PASSWORD || "UVnjwspNvpAtFGtx";
const POOL_DATABASE = process.env.PG_DATABASE || "postgres";

const BATCH = 1000;

const pool = new Pool({
  host: POOL_HOST,
  port: POOL_PORT,
  user: POOL_USER,
  password: POOL_PASSWORD,
  database: POOL_DATABASE,
  max: 5,
});

function parseMarca(desc) {
  const m = desc.match(/\bMARCA\s*[:]?\s*([^,.;]+)/i);
  return m ? m[1].trim() : null;
}

function parseModelo(desc) {
  const m = desc.match(/\bMODELO\s*[:]?\s*([^,.;]+)/i);
  return m ? m[1].trim() : null;
}

function parseSerie(desc) {
  const m = desc.match(/\bSERIE\s*[:#]?\s*(?:N[ºªo]?\s*\.?\s*)?([^,.;]+)/i);
  return m ? m[1].trim() : null;
}

function cleanValue(v) {
  if (!v) return null;
  let s = v.trim();
  if (!s) return null;
  s = s.replace(/[.,;]+$/, "").trim();
  if (!s) return null;
  if (/^S\s*\/\s*N$/i.test(s)) return null;
  if (/^SIN\s*N/i.test(s)) return null;
  if (/^(?:N\/A|NA|NONE|N\/D)$/i.test(s)) return null;
  s = s.replace(/^N[ºªo]\s*/, "").trim();
  return s || null;
}

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

async function main() {
  const client = await pool.connect();
  try {
    console.log("Conectado. Creando respaldo de la tabla...");
    await client.query("DROP TABLE IF EXISTS act_activos_bak_backfill;");
    await client.query(
      "CREATE TABLE act_activos_bak_backfill AS SELECT * FROM act_activos;"
    );
    console.log("Respaldo creado: act_activos_bak_backfill");

    const before = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE marcamaterial IS NULL OR btrim(marcamaterial::text) = '') AS marca_vacio,
        COUNT(*) FILTER (WHERE modelo IS NULL OR btrim(modelo::text) = '') AS modelo_vacio,
        COUNT(*) FILTER (WHERE serie IS NULL OR btrim(serie::text) = '') AS serie_vacio
      FROM act_activos;
    `);
    console.log("ANTES (vacíos):", before.rows[0]);

    const cand = await client.query(`
      SELECT codigoactivointerno AS id, descripcionactivo,
             marcamaterial, modelo, serie
      FROM act_activos
      WHERE descripcionactivo ~* 'MARCA'
         OR descripcionactivo ~* 'MODELO'
         OR descripcionactivo ~* 'SERIE';
    `);

    const updates = [];
    for (const row of cand.rows) {
      const marca = cleanValue(parseMarca(row.descripcionactivo));
      const modelo = cleanValue(parseModelo(row.descripcionactivo));
      const serie = cleanValue(parseSerie(row.descripcionactivo));

      const payload = {
        id: row.id,
        marca: !isBlank(row.marcamaterial) ? null : marca,
        modelo: !isBlank(row.modelo) ? null : modelo,
        serie: !isBlank(row.serie) ? null : serie,
      };
      if (payload.marca != null || payload.modelo != null || payload.serie != null) {
        updates.push(payload);
      }
    }
    console.log("Filas candidatas:", cand.rows.length, "| con cambios:", updates.length);
    await client.query("BEGIN");
    try {
      for (let i = 0; i < updates.length; i += BATCH) {
        const slice = updates.slice(i, i + BATCH);
        const ids = slice.map((u) => u.id);
        const marcas = slice.map((u) => u.marca == null ? null : String(u.marca));
        const modelos = slice.map((u) => u.modelo == null ? null : String(u.modelo));
        const series = slice.map((u) => u.serie == null ? null : String(u.serie));
        await client.query(
          `
          UPDATE act_activos a
          SET marcamaterial = COALESCE(t.marca, a.marcamaterial),
              modelo        = COALESCE(t.modelo, a.modelo),
              serie         = COALESCE(t.serie,  a.serie)
          FROM unnest($1::bigint[], $2::text[], $3::text[], $4::text[])
               AS t(id, marca, modelo, serie)
          WHERE a.codigoactivointerno = t.id;
          `,
          [ids, marcas, modelos, series]
        );
        const done = Math.min(i + BATCH, updates.length);
        if (done === updates.length || done % (BATCH * 10) === 0) {
          console.log(`Procesados ${done}/${updates.length}`);
        }
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }

    const after = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE marcamaterial IS NULL OR btrim(marcamaterial::text) = '') AS marca_vacio,
        COUNT(*) FILTER (WHERE modelo IS NULL OR btrim(modelo::text) = '') AS modelo_vacio,
        COUNT(*) FILTER (WHERE serie IS NULL OR btrim(serie::text) = '') AS serie_vacio
      FROM act_activos;
    `);
    console.log("DESPUÉS (vacíos):", after.rows[0]);
    console.log("Backfill finalizado.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});