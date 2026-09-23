import { useState, useCallback, useEffect } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/lib/supabase";
import { getCachedCatalog } from "@/lib/catalogCache";
import { toCamelCaseArray } from "@/lib/mapFields";
import { useToast } from "@/hooks/use-toast";
import { LOGO_JPG_DATA_URL } from "@/lib/logoJpgBase64";
import { ACTIVO_COLUMNS } from "@/lib/activoColumns";
import { normalizeCi, normalizeCiLoose, getCiPrefix } from "../constants/inventarioConstants";

const formatError = (err) => {
  if (!err) return "Error desconocido";
  const code = err?.code ? `[${err.code}] ` : "";
  const message = err?.message || err?.details || err?.hint || err?.error_description;
  if (message) return `${code}${message}`;
  try {
    const str = JSON.stringify(err);
    return str && str !== "{}" ? `${code}${str}` : `${code}${String(err)}`;
  } catch {
    return `${code}${String(err)}`;
  }
};

const urlToDataUrl = async (url) => {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.size > 5 * 1024 * 1024) return null;
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

// Paralelismo controlado para evitar saturar red/storage
const pMap = async (array, fn, concurrency = 12) => {
  const results = new Array(array.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(concurrency, array.length) }, async () => {
    while (true) {
      const current = idx++;
      if (current >= array.length) break;
      try {
        results[current] = await fn(array[current], current);
      } catch {
        results[current] = null;
      }
    }
  });
  await Promise.all(workers);
  return results;
};

const fetchAllImagesGrouped = async () => {
  const BUCKET = "imagenes";
  const LIMIT = 1000;
  const grouped = new Map();
  let offset = 0;
  let totalListed = 0;
  while (true) {
    const { data, error } = await supabase.storage.from(BUCKET).list("", {
      limit: LIMIT,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const f of data) {
      if (!f.name) continue;
      const sepIdx = f.name.indexOf("_");
      if (sepIdx === -1) continue;
      const codigo = f.name.substring(0, sepIdx);
      // validar que codigo es numérico
      if (!/^\d+$/.test(codigo)) continue;
      const url = supabase.storage.from(BUCKET).getPublicUrl(f.name).data.publicUrl;
      const entry = { name: f.name, url };
      if (!grouped.has(codigo)) grouped.set(codigo, []);
      grouped.get(codigo).push(entry);
    }
    totalListed += data.length;
    if (data.length < LIMIT) break;
    offset += LIMIT;
    if (totalListed > 20000) break; // safety
    // ceder event loop
    await new Promise((r) => setTimeout(r, 0));
  }
  return grouped;
};

const getImageFormat = (dataUrl) => {
  if (!dataUrl) return "JPEG";
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  return "JPEG";
};

export const useReporteInventariados = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [totalCount, setTotalCount] = useState(null);
  const [isCounting, setIsCounting] = useState(false);
  const [blockPageCounts, setBlockPageCounts] = useState(() => {
    try {
      const s = typeof window !== "undefined" ? localStorage.getItem("reporteBloquePages") : null;
      const parsed = s ? JSON.parse(s) : null;
      // migrar de 10 -> 22 bloques si es necesario
      if (Array.isArray(parsed) && parsed.length === 22) return parsed;
      if (Array.isArray(parsed) && parsed.length === 10) return [...parsed, ...Array(12).fill(null)];
      return Array(22).fill(null);
    } catch { return Array(22).fill(null); }
  });

  const refreshCount = useCallback(async () => {
    setIsCounting(true);
    try {
      // Conteo exacto igual que la generación: ultimoregistro=1 + REVISADO/INVENTARIADO
      // Usamos range paginado para evitar límites de count head con RLS y variaciones de case/espacios
      // Primero intentamos count head rápido, si difiere del fetch real lo corregimos en generate
      const { count, error } = await supabase
        .from("act_activos")
        .select("codigoactivointerno", { count: "exact", head: true })
        .eq("ultimoregistro", 1)
        .in("estadoinventario", ["REVISADO", "INVENTARIADO"]);
      if (error) throw error;

      // Validación secundaria: count sin ultimoregistro para debug de discrepancia reportada (22228)
      // Si el usuario hace COUNT sin ultimoregistro obtendrá + duplicados históricos
      if (count != null && count > 0) {
        setTotalCount(count);
      } else {
        // fallback paginado real si head falla por RLS
        let total = 0;
        let from = 0;
        const CHUNK = 1000;
        while (true) {
          const { data, error: e2 } = await supabase
            .from("act_activos")
            .select("codigoactivointerno")
            .eq("ultimoregistro", 1)
            .in("estadoinventario", ["REVISADO", "INVENTARIADO"])
            .range(from, from + CHUNK - 1);
          if (e2) throw e2;
          if (!data || data.length === 0) break;
          total += data.length;
          if (data.length < CHUNK) break;
          from += CHUNK;
          if (total > 50000) break;
        }
        setTotalCount(total);
      }
    } catch (e) {
      console.warn("No se pudo obtener conteo inventariados", e);
      // no bloquear UI, mantener null para que botón muestre sin número
    } finally {
      setIsCounting(false);
    }
  }, []);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  // MODO VISTA PREVIA: solo 10 activos para validar diseño rápido (cambiar a false para reporte completo 22k)
  // Para reporte paginado por bloques de 2000, se ignora PREVIEW_MODE
  const PREVIEW_MODE = false;
  const PREVIEW_LIMIT = 10;

  const generateChunk = useCallback(async (chunkIndex) => {
    // chunkIndex 0..21 => 0:0-1999, 1:2000-3999, ..., 21:42000-43999
    const CHUNK_SIZE = 2000;
    const offset = chunkIndex * CHUNK_SIZE;
    const limit = CHUNK_SIZE;
    setIsGenerating(true);
    try {
      // Reutiliza lógica de generate pero con slice por ubicación ordenada
      const [rubros, tipoRubros, ambientes, responsables, ciudades, inmuebles, niveles] = await Promise.all([
        getCachedCatalog("act_rubro"),
        getCachedCatalog("act_tiporubro"),
        getCachedCatalog("act_ambiente"),
        getCachedCatalog("act_responsable"),
        getCachedCatalog("act_ciudad"),
        getCachedCatalog("act_inmueble"),
        getCachedCatalog("act_nivel"),
      ]);

      const rubroDescMap = {};
      (rubros || []).forEach((r) => {
        rubroDescMap[r.codigorubroact] = r.descripcionrubroact;
        rubroDescMap[String(r.codigorubroact)] = r.descripcionrubroact;
      });
      const tipoRubroDescMap = {};
      const rubroFromTipo = {};
      (tipoRubros || []).forEach((t) => {
        tipoRubroDescMap[t.tiporubroact] = t.descripciontiporubroact;
        tipoRubroDescMap[String(t.tiporubroact)] = t.descripciontiporubroact;
        rubroFromTipo[t.tiporubroact] = rubroDescMap[t.codigorubroact];
        rubroFromTipo[String(t.tiporubroact)] = rubroDescMap[t.codigorubroact];
      });
      const nivelMap = {};
      (niveles || []).forEach((n) => {
        nivelMap[String(n.codigonivel ?? "").trim()] = n;
      });
      const inmuebleMap = {};
      (inmuebles || []).forEach((i) => {
        inmuebleMap[String(i.codigoinmueble ?? "").trim()] = i;
      });
      const ciudadMap = {};
      (ciudades || []).forEach((c) => {
        ciudadMap[String(c.codigociudad ?? "").trim()] = c;
      });
      const ubicacionJerarquiaMap = {};
      (ambientes || []).forEach((a) => {
        const code = String(a.codigoambiente ?? "").trim();
        if (!code) return;
        const nivel = nivelMap[String(a.codigonivel ?? "").trim()];
        const inmueble = nivel ? inmuebleMap[String(nivel.codigoinmueble ?? "").trim()] : null;
        const ciudad = inmueble ? ciudadMap[String(inmueble.codigociudad ?? "").trim()] : null;
        ubicacionJerarquiaMap[code] =
          [ciudad?.descripcion, inmueble?.inmueble, nivel?.nivel, a.ambiente]
            .map((s) => (s || "").trim())
            .filter(Boolean)
            .join(" / ") || String(code);
      });
      const responsableMap = {};
      (responsables || []).forEach((r) => {
        const raw = String(r.cirun ?? "").trim();
        responsableMap[raw] = r;
        const norm = normalizeCi(r.cirun);
        if (norm !== raw) responsableMap[norm] = r;
        const loose = normalizeCiLoose(r.cirun);
        if (loose !== raw && loose !== norm) responsableMap[loose] = r;
        const prefix = getCiPrefix(raw);
        if (prefix && prefix !== raw && prefix !== norm && prefix !== loose) responsableMap[prefix] = r;
      });
      const resolveResponsableName = (cirun) => {
        const rawCi = String(cirun ?? "").trim();
        if (!rawCi) return "—";
        const normCi = normalizeCi(rawCi);
        const looseCi = normalizeCiLoose(rawCi);
        const prefixCi = getCiPrefix(rawCi);
        const resp = responsableMap[normCi] || responsableMap[looseCi] || responsableMap[prefixCi] || responsableMap[rawCi];
        if (!resp) return rawCi || "—";
        return [resp.nombre1, resp.nombre2, resp.paterno, resp.materno].map((s) => (s || "").trim()).filter(Boolean).join(" ") || resp.cirun;
      };

      toast({ title: `Generando bloque ${chunkIndex + 1}/22`, description: `Cargando activos ${offset + 1} al ${offset + limit} ordenados por ubicación...` });
      // Fetch completo para orden global por ubicación, luego slice
      let allActivos = [];
      let from = 0;
      const FETCH_CHUNK = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("act_activos")
          .select(ACTIVO_COLUMNS)
          .eq("ultimoregistro", 1)
          .in("estadoinventario", ["REVISADO", "INVENTARIADO"])
          .order("codigoambiente", { ascending: true })
          .order("codigoactivo", { ascending: true })
          .range(from, from + FETCH_CHUNK - 1);
        if (error) throw error;
        const batch = toCamelCaseArray(data || []);
        if (batch.length === 0) break;
        allActivos = allActivos.concat(batch);
        if (batch.length < FETCH_CHUNK) break;
        from += FETCH_CHUNK;
        if (allActivos.length > 44000) break;
        await new Promise((r) => setTimeout(r, 0));
      }
      if (allActivos.length === 0) {
        toast({ title: "Sin datos", description: "No hay activos.", variant: "destructive" });
        return;
      }
      let enrichedAll = allActivos.map((a) => {
        const tipoDesc = tipoRubroDescMap[a.tipoRubroAct] ?? tipoRubroDescMap[String(a.tipoRubroAct)] ?? "—";
        const rubroDesc = rubroFromTipo[a.tipoRubroAct] ?? rubroFromTipo[String(a.tipoRubroAct)] ?? "—";
        const ambCode = String(a.codigoAmbiente ?? "").trim();
        const ubicacion = ubicacionJerarquiaMap[ambCode] || ambCode || "—";
        const responsableName = resolveResponsableName(a.cirun);
        const ci = String(a.cirun ?? "").trim() || "—";
        const codigoFormateado = a.codigoActivo != null ? `OJ-02-${a.codigoActivo}` : "—";
        const descripcion = String(a.descripcionActivo ?? a.descripcionactivo ?? "—").replace(/\s+/g, " ").trim() || "—";
        return { raw: a, codigoFormateado, rubroDesc, tipoDesc, descripcion, ubicacion, responsableName, ci, ambCode };
      });
      enrichedAll.sort((a, b) => {
        const ua = (a.ubicacion || "").toLowerCase();
        const ub = (b.ubicacion || "").toLowerCase();
        if (ua !== ub) return ua.localeCompare(ub, "es");
        return String(a.codigoFormateado).localeCompare(String(b.codigoFormateado));
      });

      const enriched = enrichedAll.slice(offset, offset + limit);
      if (enriched.length === 0) {
        toast({ title: "Sin datos", description: `No hay activos en el rango ${offset + 1}-${offset + limit}.`, variant: "destructive" });
        return;
      }

      // Reusar generación PDF del flujo normal pero con slice
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      try { doc.addImage(LOGO_JPG_DATA_URL, "JPEG", 14, 8, 48, 48 * (57 / 256)); } catch (_) { }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(`FICHAS TECNICAS DE LOS ACTIVOS FIJOS`, pageWidth / 2, 20, { align: "center" });
      const startNum = offset + 1;
      const endNum = offset + enriched.length;

      // SOLO FICHAS TECNICAS - sin tabla resumen
      toast({ title: "Generando fichas", description: `Preparando fichas técnicas para bloque ${chunkIndex + 1} (${enriched.length} activos)...` });
      let imagesGrouped = new Map();
      try { imagesGrouped = await fetchAllImagesGrouped(); } catch (imgErr) { console.warn(imgErr); imagesGrouped = new Map(); }
      const allFilesFlat = [];
      enriched.forEach((e) => {
        const codigoRaw = String(e.raw.codigoActivo ?? "").trim();
        if (!codigoRaw) return;
        const files = imagesGrouped.get(codigoRaw) || [];
        files.forEach((f) => allFilesFlat.push(f));
      });
      const dataUrlMap = new Map();
      if (allFilesFlat.length > 0) {
        toast({ title: "Descargando fotos", description: `${allFilesFlat.length} imágenes en paralelo...` });
        await pMap(allFilesFlat, async (file) => {
          const d = await urlToDataUrl(file.url);
          if (d) dataUrlMap.set(file.name, d);
        }, 15);
      }

      // FICHAS COMPACTAS - varias por página, separación mínima (gap 4mm)
      let yFicha = 36;
      for (let idx = 0; idx < enriched.length; idx++) {
        const e = enriched[idx];
        const a = e.raw;
        // Estimar altura ficha: tabla 12 filas ~28mm + fotos (si hay) ~18mm por fila + gaps
        const codigoRawEst = String(e.raw.codigoActivo ?? "").trim();
        const filesEst = imagesGrouped.get(codigoRawEst) || [];
        const availEst = filesEst.filter((f) => dataUrlMap.has(f.name));
        const fotosFilas = availEst.length > 0 ? Math.ceil(availEst.length / 4) : 0;
        const estH = 38 + (fotosFilas > 0 ? 8 + fotosFilas * 28 : 6);
        if (yFicha + estH > pageHeight - 12) {
          doc.addPage();
          yFicha = 26;
        }
        // Título ficha compacto
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(0, 70, 140);
        doc.text("FICHA TECNICA DEL ACTIVO FIJO", 14, yFicha);
        yFicha += 3;
        doc.setDrawColor(0, 70, 140);
        doc.setLineWidth(0.3);
        doc.line(14, yFicha, pageWidth - 14, yFicha);
        yFicha += 2;

        const fichaData = [
          ["CÓDIGO ACTIVO", e.codigoFormateado],
          ["DESCRIPCIÓN", e.descripcion],
          ["CARNET (CI)", e.ci],
          ["RESPONSABLE", e.responsableName],
          ["RUBRO", e.rubroDesc],
          ["TIPO DE RUBRO", e.tipoDesc],
          ["UBICACIÓN", e.ubicacion],
          ["ESTADO", String(a.estadoConservacion || a.estadoconservacion || "—").toUpperCase()],
        ];
        autoTable(doc, {
          startY: yFicha,
          body: fichaData,
          theme: "plain",
          styles: { font: "helvetica", fontSize: 7, cellPadding: 1.6, lineColor: [200, 200, 200], lineWidth: 0.08, valign: "top", halign: "left" },
          columnStyles: {
            0: { cellWidth: 38, fontStyle: "bold", fillColor: [240, 240, 240], halign: "left", fontSize: 7 },
            1: { cellWidth: pageWidth - 28 - 38, halign: "left" },
          },
          margin: { left: 14, right: 14 },
          didParseCell: (data) => {
            // DESCRIPCIÓN no centrada, siempre a la izquierda
            data.cell.styles.halign = data.column.index === 0 ? "left" : "left";
          },
        });
        yFicha = doc.lastAutoTable.finalY + 3;

        const codigoRaw = String(e.raw.codigoActivo ?? "").trim();
        const files = imagesGrouped.get(codigoRaw) || [];
        const available = files.filter((f) => dataUrlMap.has(f.name));
        if (available.length === 0) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6);
          doc.setTextColor(130);
          doc.text("Sin fotografías.", 14, yFicha + 2);
          yFicha += 6;
        } else {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(6);
          doc.setTextColor(0, 70, 140);
          doc.text("FOTOS:", 14, yFicha);
          yFicha += 3;
          const imgW = 32;
          const imgH = 24;
          const gapX = 3;
          const gapY = 4;
          const cols = 7;
          const totalWidth = cols * imgW + (cols - 1) * gapX;
          const startX = (pageWidth - totalWidth) / 2;
          let col = 0;
          let curY = yFicha;
          for (let fIdx = 0; fIdx < available.length; fIdx++) {
            const file = available[fIdx];
            const dataUrl = dataUrlMap.get(file.name);
            if (!dataUrl) continue;
            const x = startX + col * (imgW + gapX);
            if (curY + imgH > pageHeight - 10) {
              doc.addPage();
              yFicha = 26;
              curY = 26;
            }
            const format = getImageFormat(dataUrl);
            try {
              doc.addImage(dataUrl, format, x, curY, imgW, imgH);
              doc.setDrawColor(180);
              doc.rect(x, curY, imgW, imgH);
            } catch (err) { console.warn(err); }
            col++;
            if (col >= cols) { col = 0; curY += imgH + gapY; }
          }
          if (col !== 0) curY += imgH + gapY; else curY += 2;
          yFicha = curY;
        }
        // Separador mínimo entre fichas (4mm) - no página completa
        if (idx < enriched.length - 1) {
          if (yFicha + 6 > pageHeight - 10) {
            doc.addPage();
            yFicha = 26;
          } else {
            doc.setDrawColor(220);
            doc.setLineWidth(0.15);
            doc.line(14, yFicha, pageWidth - 14, yFicha);
            yFicha += 4;
          }
          if (idx % 30 === 29) await new Promise((r) => setTimeout(r, 0));
        }
      }
      const totalPages = doc.getNumberOfPages();
      // Paginación correlativa entre bloques: pageOffset = suma páginas bloques anteriores (estimado 570 si aún no generado ~850*2000/3000)
      const ESTIMATED = 570;
      const pageOffset = blockPageCounts.slice(0, chunkIndex).reduce((acc, v) => acc + (v ?? ESTIMATED), 0);
      const globalTotal = blockPageCounts.every((v) => v != null)
        ? blockPageCounts.reduce((a, b) => a + b, 0) - (blockPageCounts[chunkIndex] ?? 0) + totalPages
        : 22 * ESTIMATED;
      // Guardar conteo real para próximos bloques
      const nextCounts = [...blockPageCounts];
      nextCounts[chunkIndex] = totalPages;
      setBlockPageCounts(nextCounts);
      try { localStorage.setItem("reporteBloquePages", JSON.stringify(nextCounts)); } catch { }
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        if (i > 1) { try { doc.addImage(LOGO_JPG_DATA_URL, "JPEG", 14, 8, 48, 48 * (57 / 256)); } catch (_) { } }
        doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.text(`Página ${pageOffset + i} de ${globalTotal}`, pageWidth / 2, pageHeight - 6, { align: "center" });
      }
      const dateStr = new Date().toISOString().slice(0, 10);
      doc.save(`Activos_Inventariados_Bloque${chunkIndex + 1}_${startNum}-${endNum}_${dateStr}.pdf`);
      toast({ title: "Bloque generado", description: `Bloque ${chunkIndex + 1}: ${enriched.length} activos (${startNum}-${endNum}) — Páginas ${pageOffset + 1}-${pageOffset + totalPages} de ${globalTotal} (correlativo).` });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: `No se pudo generar bloque: ${formatError(err)}`, variant: "destructive" });
    } finally { setIsGenerating(false); }
  }, [toast, blockPageCounts]);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    try {
      // 1. Cargar catálogos
      const [rubros, tipoRubros, ambientes, responsables, ciudades, inmuebles, niveles] = await Promise.all([
        getCachedCatalog("act_rubro"),
        getCachedCatalog("act_tiporubro"),
        getCachedCatalog("act_ambiente"),
        getCachedCatalog("act_responsable"),
        getCachedCatalog("act_ciudad"),
        getCachedCatalog("act_inmueble"),
        getCachedCatalog("act_nivel"),
      ]);

      const rubroDescMap = {};
      (rubros || []).forEach((r) => {
        rubroDescMap[r.codigorubroact] = r.descripcionrubroact;
        rubroDescMap[String(r.codigorubroact)] = r.descripcionrubroact;
      });

      const tipoRubroDescMap = {};
      const rubroFromTipo = {};
      (tipoRubros || []).forEach((t) => {
        tipoRubroDescMap[t.tiporubroact] = t.descripciontiporubroact;
        tipoRubroDescMap[String(t.tiporubroact)] = t.descripciontiporubroact;
        rubroFromTipo[t.tiporubroact] = rubroDescMap[t.codigorubroact];
        rubroFromTipo[String(t.tiporubroact)] = rubroDescMap[t.codigorubroact];
      });

      // Mapas para ubicación jerárquica
      const nivelMap = {};
      (niveles || []).forEach((n) => {
        nivelMap[String(n.codigonivel ?? "").trim()] = n;
      });
      const inmuebleMap = {};
      (inmuebles || []).forEach((i) => {
        inmuebleMap[String(i.codigoinmueble ?? "").trim()] = i;
      });
      const ciudadMap = {};
      (ciudades || []).forEach((c) => {
        ciudadMap[String(c.codigociudad ?? "").trim()] = c;
      });
      const ubicacionJerarquiaMap = {};
      (ambientes || []).forEach((a) => {
        const code = String(a.codigoambiente ?? "").trim();
        if (!code) return;
        const nivel = nivelMap[String(a.codigonivel ?? "").trim()];
        const inmueble = nivel ? inmuebleMap[String(nivel.codigoinmueble ?? "").trim()] : null;
        const ciudad = inmueble ? ciudadMap[String(inmueble.codigociudad ?? "").trim()] : null;
        ubicacionJerarquiaMap[code] =
          [ciudad?.descripcion, inmueble?.inmueble, nivel?.nivel, a.ambiente]
            .map((s) => (s || "").trim())
            .filter(Boolean)
            .join(" / ") || String(code);
      });

      const responsableMap = {};
      (responsables || []).forEach((r) => {
        const raw = String(r.cirun ?? "").trim();
        responsableMap[raw] = r;
        const norm = normalizeCi(r.cirun);
        if (norm !== raw) responsableMap[norm] = r;
        const loose = normalizeCiLoose(r.cirun);
        if (loose !== raw && loose !== norm) responsableMap[loose] = r;
        const prefix = getCiPrefix(raw);
        if (prefix && prefix !== raw && prefix !== norm && prefix !== loose) responsableMap[prefix] = r;
      });

      const resolveResponsableName = (cirun) => {
        const rawCi = String(cirun ?? "").trim();
        if (!rawCi) return "—";
        const normCi = normalizeCi(rawCi);
        const looseCi = normalizeCiLoose(rawCi);
        const prefixCi = getCiPrefix(rawCi);
        const resp =
          responsableMap[normCi] ||
          responsableMap[looseCi] ||
          responsableMap[prefixCi] ||
          responsableMap[rawCi];
        if (!resp) return rawCi || "—";
        return [resp.nombre1, resp.nombre2, resp.paterno, resp.materno].map((s) => (s || "").trim()).filter(Boolean).join(" ") || resp.cirun;
      };

      // 2. Fetch activos REVISADO + INVENTARIADO (con modo preview 10 para diseño)
      const CHUNK = PREVIEW_MODE ? PREVIEW_LIMIT : 1000;
      let allActivos = [];
      let from = 0;
      toast({ title: PREVIEW_MODE ? "Vista previa (10 activos)" : "Generando reporte", description: PREVIEW_MODE ? "Cargando solo 10 activos para validar diseño..." : "Cargando activos INVENTARIADO y REVISADO (ultimoregistro=1)..." });
      if (PREVIEW_MODE) {
        const { data, error } = await supabase
          .from("act_activos")
          .select(ACTIVO_COLUMNS)
          .eq("ultimoregistro", 1)
          .in("estadoinventario", ["REVISADO", "INVENTARIADO"])
          .order("codigoambiente", { ascending: true })
          .order("codigoactivo", { ascending: true })
          .range(0, PREVIEW_LIMIT - 1);
        if (error) throw error;
        allActivos = toCamelCaseArray(data || []);
      } else {
        while (true) {
          const { data, error } = await supabase
            .from("act_activos")
            .select(ACTIVO_COLUMNS)
            .eq("ultimoregistro", 1)
            .in("estadoinventario", ["REVISADO", "INVENTARIADO"])
            .order("codigoambiente", { ascending: true })
            .order("codigoactivo", { ascending: true })
            .range(from, from + CHUNK - 1);
          if (error) throw error;
          const batch = toCamelCaseArray(data || []);
          if (batch.length === 0) break;
          allActivos = allActivos.concat(batch);
          if (batch.length < CHUNK) break;
          from += CHUNK;
          if (allActivos.length > 44000) {
            toast({ title: "Límite alcanzado", description: `Se cargaron ${allActivos.length} activos (límite 44000). El reporte se truncará.`, variant: "destructive" });
            break;
          }
          await new Promise((r) => setTimeout(r, 0));
        }
        if (allActivos.length > 0 && totalCount !== allActivos.length) {
          setTotalCount(allActivos.length);
        }
      }

      if (allActivos.length === 0) {
        toast({
          title: "Sin datos",
          description: "No hay activos en estado REVISADO o INVENTARIADO.",
          variant: "destructive",
        });
        return;
      }

      // 3. Enriquecer y ordenar por Ubicación (en preview limitar a 10 tras sort)
      let enriched = allActivos.map((a) => {
        const tipoDesc = tipoRubroDescMap[a.tipoRubroAct] ?? tipoRubroDescMap[String(a.tipoRubroAct)] ?? "—";
        const rubroDesc = rubroFromTipo[a.tipoRubroAct] ?? rubroFromTipo[String(a.tipoRubroAct)] ?? "—";
        const ambCode = String(a.codigoAmbiente ?? "").trim();
        const ubicacion = ubicacionJerarquiaMap[ambCode] || ambCode || "—";
        const responsableName = resolveResponsableName(a.cirun);
        const ci = String(a.cirun ?? "").trim() || "—";
        const codigoFormateado = a.codigoActivo != null ? `OJ-02-${a.codigoActivo}` : "—";
        const descripcion = String(a.descripcionActivo ?? a.descripcionactivo ?? "—").replace(/\s+/g, " ").trim() || "—";
        return {
          raw: a,
          codigoFormateado,
          rubroDesc,
          tipoDesc,
          descripcion,
          ubicacion,
          responsableName,
          ci,
          ambCode,
        };
      });

      enriched.sort((a, b) => {
        const ua = (a.ubicacion || "").toLowerCase();
        const ub = (b.ubicacion || "").toLowerCase();
        if (ua !== ub) return ua.localeCompare(ub, "es");
        return String(a.codigoFormateado).localeCompare(String(b.codigoFormateado));
      });
      if (PREVIEW_MODE && enriched.length > PREVIEW_LIMIT) {
        enriched = enriched.slice(0, PREVIEW_LIMIT);
      }

      // 4. Generar PDF
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Header logo + título
      try {
        doc.addImage(LOGO_JPG_DATA_URL, "JPEG", 14, 8, 48, 48 * (57 / 256));
      } catch (_) { }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(`FICHAS TECNICAS DE LOS ACTIVOS FIJOS`, pageWidth / 2, 20, { align: "center" });

      // SOLO FICHAS TECNICAS - sin tabla resumen (solicitud: solo ficha tecnica)

      // 5. FICHAS TECNICAS POR ACTIVO - debajo de cada activo sus fotos
      toast({ title: "Generando fichas", description: `Preparando fichas técnicas para ${enriched.length} activos...` });
      let imagesGrouped = new Map();
      try { imagesGrouped = await fetchAllImagesGrouped(); } catch (imgErr) { console.warn(imgErr); imagesGrouped = new Map(); }
      const allFilesFlat = [];
      enriched.forEach((e) => {
        const codigoRaw = String(e.raw.codigoActivo ?? "").trim();
        if (!codigoRaw) return;
        const files = imagesGrouped.get(codigoRaw) || [];
        files.forEach((f) => allFilesFlat.push(f));
      });
      const dataUrlMap = new Map();
      if (allFilesFlat.length > 0) {
        toast({ title: "Descargando fotos", description: `${allFilesFlat.length} imágenes en paralelo...` });
        await pMap(allFilesFlat, async (file) => {
          const d = await urlToDataUrl(file.url);
          if (d) dataUrlMap.set(file.name, d);
        }, 15);
      }

      let yFicha = 36;
      for (let idx = 0; idx < enriched.length; idx++) {
        const e = enriched[idx];
        const a = e.raw;
        const codigoRawEst2 = String(e.raw.codigoActivo ?? "").trim();
        const filesEst2 = imagesGrouped.get(codigoRawEst2) || [];
        const availEst2 = filesEst2.filter((f) => dataUrlMap.has(f.name));
        const fotosFilas2 = availEst2.length > 0 ? Math.ceil(availEst2.length / 7) : 0;
        const estH2 = 38 + (fotosFilas2 > 0 ? 8 + fotosFilas2 * 20 : 6);
        if (yFicha + estH2 > pageHeight - 12) {
          doc.addPage();
          yFicha = 26;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(0, 70, 140);
        doc.text("FICHA TECNICA DEL ACTIVO FISICO", 14, yFicha);
        doc.setFontSize(6);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80);
        doc.text(`Act.${idx + 1}/${enriched.length} | ${e.codigoFormateado}`, pageWidth - 14, yFicha, { align: "right" });
        yFicha += 3;
        doc.setDrawColor(0, 70, 140);
        doc.setLineWidth(0.3);
        doc.line(14, yFicha, pageWidth - 14, yFicha);
        yFicha += 2;

        const fichaData = [
          ["CÓDIGO", e.codigoFormateado, "DESCRIPCIÓN", e.descripcion],
          ["CARNET RESPONSABLE", e.ci, "RESPONSABLE", e.responsableName],
          ["RUBRO", e.rubroDesc, "TIPO", e.tipoDesc],
          ["UBICACIÓN", e.ubicacion, "ESTADO", String(a.estadoConservacion || a.estadoconservacion || "—").toUpperCase()],
        ];
        autoTable(doc, {
          startY: yFicha,
          body: fichaData,
          theme: "plain",
          styles: { font: "helvetica", fontSize: 6, cellPadding: 1.2, lineColor: [200, 200, 200], lineWidth: 0.08, valign: "top" },
          columnStyles: {
            0: { cellWidth: 24, fontStyle: "bold", fillColor: [240, 240, 240], halign: "left", fontSize: 6 },
            1: { cellWidth: 78 },
            2: { cellWidth: 20, fontStyle: "bold", fillColor: [240, 240, 240], halign: "left", fontSize: 6 },
            3: { cellWidth: pageWidth - 28 - 24 - 78 - 20 },
          },
          margin: { left: 14, right: 14 },
          didParseCell: (data) => {
            if (data.column.index === 3) {
              if (data.row.index === 0 || data.row.index === 2 || data.row.index === 3) {
                data.cell.styles.halign = "left";
              } else if (data.row.index === 1) {
                data.cell.styles.halign = "left";
              }
            }
            if (data.column.index === 1) {
              data.cell.styles.halign = "left";
            }
          },
        });
        let y = doc.lastAutoTable.finalY + 3;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6);
        doc.setTextColor(0, 70, 140);
        doc.text("FOTOS:", 14, y);
        y += 3;
        const codigoRaw = String(e.raw.codigoActivo ?? "").trim();
        const files = imagesGrouped.get(codigoRaw) || [];
        const available = files.filter((f) => dataUrlMap.has(f.name));
        if (available.length === 0) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6);
          doc.setTextColor(130);
          doc.text("Sin fotografías.", 14, y + 2);
          y += 6;
        } else {
          const imgW = 32;
          const imgH = 24;
          const gapX = 3;
          const gapY = 4;
          const cols = 7;
          const totalWidth = cols * imgW + (cols - 1) * gapX;
          const startX = (pageWidth - totalWidth) / 2;
          let col = 0;
          let curY = y;
          for (let fIdx = 0; fIdx < available.length; fIdx++) {
            const file = available[fIdx];
            const dataUrl = dataUrlMap.get(file.name);
            if (!dataUrl) continue;
            const x = startX + col * (imgW + gapX);
            if (curY + imgH > pageHeight - 10) {
              doc.addPage();
              curY = 26;
            }
            const format = getImageFormat(dataUrl);
            try {
              doc.addImage(dataUrl, format, x, curY, imgW, imgH);
              doc.setDrawColor(180);
              doc.rect(x, curY, imgW, imgH);
            } catch (err) { console.warn(err); }
            col++;
            if (col >= cols) { col = 0; curY += imgH + gapY; }
          }
          if (col !== 0) curY += imgH + gapY; else curY += 2;
          y = curY;
        }
        // Separador mínimo entre fichas
        if (idx < enriched.length - 1) {
          if (y + 6 > pageHeight - 10) {
            doc.addPage();
            yFicha = 26;
            y = 26;
          } else {
            doc.setDrawColor(220);
            doc.setLineWidth(0.15);
            doc.line(14, y, pageWidth - 14, y);
            y += 4;
            yFicha = y;
          }
          if (idx % 30 === 29) await new Promise((r) => setTimeout(r, 0));
        } else {
          yFicha = y;
        }
      }

      // Numeración páginas
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        if (i > 1) {
          try { doc.addImage(LOGO_JPG_DATA_URL, "JPEG", 14, 8, 48, 48 * (57 / 256)); } catch (_) { }
        }
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 6, { align: "center" });
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      doc.save(PREVIEW_MODE ? `Activos_Inventariados_PREVIEW_10_${dateStr}.pdf` : `Activos_Inventariados_REVISADO-INVENTARIADO_${dateStr}.pdf`);

      toast({
        title: PREVIEW_MODE ? "Vista previa generada" : "Reporte generado",
        description: PREVIEW_MODE ? `Se exportaron ${enriched.length} activos (preview 10) - pon PREVIEW_MODE=false para 22k` : `Se exportaron ${enriched.length} activos (REVISADO + INVENTARIADO) ordenados por ubicación.`,
      });
    } catch (err) {
      console.error("Error generando reporte inventariados", err);
      toast({
        title: "Error",
        description: `No se pudo generar el reporte: ${formatError(err)}`,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, generateChunk, isGenerating, totalCount, isCounting, refreshCount };
};
