import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { getCachedCatalog } from "@/lib/catalogCache";
import { toCamelCaseArray } from "@/lib/mapFields";
import { LOGO_JPG_DATA_URL } from "@/lib/logoJpgBase64";
import { ACTIVO_COLUMNS } from "@/lib/activoColumns";
import { normalizeCi, normalizeCiLoose, getCiPrefix } from "../constants/inventarioConstants";
import { fetchActivoImages } from "@/inventario/services/inventarioService";

// Tamaño de cada bloque de impresión de la Evaluación Técnica
export const EV_TECNICA_BLOQUE = 300;

const LOGO_W = 32;
const LOGO_H = LOGO_W * (57 / 256);
const addLogo = (doc) => {
  try {
    doc.addImage(LOGO_JPG_DATA_URL, "JPEG", 10, 6, LOGO_W, LOGO_H);
  } catch {
    // sin logo: continúa sin imagen
  }
};

const urlToBase64 = async (url) => {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

const getEstadoAltaBajaLabel = (v) => {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "1" || s === "TRUE" || s === "ALTA") return "Alta";
  if (s === "0" || s === "FALSE" || s === "BAJA") return "Baja";
  return s || "—";
};

const clean = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

const mapWithConcurrency = async (items, limit, fn) => {
  const results = new Array(items.length);
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
};

// Cache bulk de fotos por proyecto: 1 solo escaneo del bucket `imagenes`
// en vez de 1 list() por activo (300 list por bloque). Se reutiliza entre
// bloques y entre dryRun / generación real.
let bulkFotosCache = { sig: "", map: new Map(), fetchedAt: 0 };
const BULK_FOTOS_TTL = 5 * 60 * 1000;

const bulkSigOf = (codigos) => {
  if (!codigos || codigos.length === 0) return "empty";
  return `${codigos.length}:${codigos[0]}:${codigos[codigos.length - 1]}`;
};

export const fetchEvaluacionFotosMap = async (codigos = []) => {
  const wantedList = (codigos || []).map((c) => String(c));
  const wanted = new Set(wantedList);
  const sig = bulkSigOf(wantedList);
  const now = Date.now();
  if (bulkFotosCache.sig === sig && now - bulkFotosCache.fetchedAt < BULK_FOTOS_TTL) {
    const hit = wantedList.every((c) => bulkFotosCache.map.has(String(c)));
    if (hit) return bulkFotosCache.map;
  }
  const map = new Map();
  wanted.forEach((c) => map.set(String(c), []));
  try {
    const PAGE = 1000;
    let offset = 0;
    for (;;) {
      const { data, error } = await supabase.storage
        .from("imagenes")
        .list("", { limit: PAGE, offset, sortBy: { column: "name", order: "asc" } });
      if (error) throw error;
      const list = data || [];
      for (const f of list) {
        const name = String(f?.name || "");
        if (!name || name.toUpperCase().includes("_COT")) continue;
        const code = name.split("_")[0];
        if (!code || !wanted.has(code)) continue;
        const { data: urlData } = supabase.storage.from("imagenes").getPublicUrl(name);
        map.get(code).push({ name, url: urlData?.publicUrl });
      }
      if (list.length < PAGE) break;
      offset += PAGE;
      if (offset > 120000) break;
      // ceder el hilo para no congelar la UI durante el escaneo
      await new Promise((r) => setTimeout(r, 0));
    }
  } catch (e) {
    // Si el escaneo masivo falla, devolver mapa vacío para que el
    // llamador use el fallback por activo.
    console.warn("Bulk fotos falló, se usará fallback por activo:", e?.message || e);
    return new Map();
  }
  bulkFotosCache = { sig, map, fetchedAt: Date.now() };
  return map;
};

/**
 * Base de la Evaluación Técnica: estado=1 AND ultimoregistro=1
 * AND estadoconservacion en (BUENO, REGULAR). Orden: codigoactivo ASC.
 * Devuelve filas ya enriquecidas para PDF y Excel.
 */
export const fetchEvaluacionTecnicaActivos = async () => {
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
  const rubroFromTipo = {};
  const tipoRubroDescMap = {};
  (tipoRubros || []).forEach((t) => {
    rubroFromTipo[t.tiporubroact] = rubroDescMap[t.codigorubroact];
    rubroFromTipo[String(t.tiporubroact)] = rubroDescMap[t.codigorubroact];
    tipoRubroDescMap[t.tiporubroact] = t.descripciontiporubroact;
    tipoRubroDescMap[String(t.tiporubroact)] = t.descripciontiporubroact;
  });

  const nivelMap = {};
  (niveles || []).forEach((n) => { nivelMap[String(n.codigonivel ?? "").trim()] = n; });
  const inmuebleMap = {};
  (inmuebles || []).forEach((i) => { inmuebleMap[String(i.codigoinmueble ?? "").trim()] = i; });
  const ciudadMap = {};
  (ciudades || []).forEach((c) => { ciudadMap[String(c.codigociudad ?? "").trim()] = c; });
  const ubicacionMap = {};
  const ubicacionPartsMap = {};
  (ambientes || []).forEach((a) => {
    const code = String(a.codigoambiente ?? "").trim();
    if (!code) return;
    const nivel = nivelMap[String(a.codigonivel ?? "").trim()];
    const inmueble = nivel ? inmuebleMap[String(nivel.codigoinmueble ?? "").trim()] : null;
    const ciudad = inmueble ? ciudadMap[String(inmueble.codigociudad ?? "").trim()] : null;
    const parts = {
      ciudad: String(ciudad?.descripcion ?? "").trim(),
      inmueble: String(inmueble?.inmueble ?? "").trim(),
      nivel: String(nivel?.nivel ?? "").trim(),
      ambiente: String(a.ambiente ?? "").trim(),
    };
    ubicacionPartsMap[code] = parts;
    ubicacionMap[code] =
      [parts.ciudad, parts.inmueble, parts.nivel, parts.ambiente].filter(Boolean).join(" / ") || code;
  });

  const respMap = {};
  (responsables || []).forEach((r) => {
    const raw = String(r.cirun ?? "").trim();
    respMap[raw] = r;
    const norm = normalizeCi(r.cirun);
    if (norm !== raw) respMap[norm] = r;
    const loose = normalizeCiLoose(r.cirun);
    if (loose !== raw && loose !== norm) respMap[loose] = r;
    const prefix = getCiPrefix(raw);
    if (prefix && prefix !== raw && prefix !== norm && prefix !== loose) respMap[prefix] = r;
  });
  const responsableNameOf = (cirun) => {
    const rawCi = String(cirun ?? "").trim();
    if (!rawCi) return "—";
    const resp =
      respMap[normalizeCi(rawCi)] || respMap[normalizeCiLoose(rawCi)] ||
      respMap[getCiPrefix(rawCi)] || respMap[rawCi];
    if (!resp) return rawCi;
    return (
      [resp.nombre1, resp.nombre2, resp.paterno, resp.materno]
        .map((s) => (s || "").trim())
        .filter(Boolean)
        .join(" ") || resp.cirun
    );
  };

  let allActivos = [];
  {
    let from = 0;
    const FETCH_CHUNK = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("act_activos")
        .select(ACTIVO_COLUMNS)
        .eq("estado", 1)
        .eq("ultimoregistro", 1)
        .in("estadoconservacion", ["BUENO", "REGULAR"])
        .range(from, from + FETCH_CHUNK - 1);
      if (error) throw error;
      const batch = toCamelCaseArray(data || []);
      if (batch.length === 0) break;
      allActivos = allActivos.concat(batch);
      if (batch.length < FETCH_CHUNK) break;
      from += FETCH_CHUNK;
      if (allActivos.length > 100000) break;
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  // Refuerzo en cliente: estado=1, ultimoregistro=1 y solo BUENO/REGULAR
  allActivos = allActivos.filter((a) => {
    const est = a.estado ?? a.estadoActivo;
    const esAlta =
      est === 1 || est === true
        ? true
        : ["1", "TRUE", "T", "ALTA"].includes(String(est ?? "").trim().toUpperCase());
    if (!esAlta) return false;
    if (String(a.ultimoRegistro ?? a.ultimoregistro ?? "").trim() !== "1") return false;
    const cons = String(a.estadoConservacion ?? a.estadoconservacion ?? "").trim().toUpperCase();
    if (cons !== "BUENO" && cons !== "REGULAR") return false;
    return true;
  });
  allActivos.sort((a, b) => Number(a.codigoActivo ?? a.codigoactivo ?? 0) - Number(b.codigoActivo ?? b.codigoactivo ?? 0));

  return allActivos.map((a) => {
    const codigoActivo = a.codigoActivo ?? a.codigoactivo;
    const tipoRubroAct = a.tipoRubroAct ?? a.tiporubroact;
    const ambCode = String(a.codigoAmbiente ?? a.codigoambiente ?? "").trim();
    const ciRaw = String(a.cirun ?? "").trim();
    return {
      codigoActivo,
      codigo: codigoActivo != null ? `OJ-02-${codigoActivo}` : "—",
      rubroDesc: rubroFromTipo[tipoRubroAct] ?? rubroFromTipo[String(tipoRubroAct)] ?? "—",
      tipoDesc: tipoRubroDescMap[tipoRubroAct] ?? tipoRubroDescMap[String(tipoRubroAct)] ?? "—",
      ubicacion: ubicacionMap[ambCode] || ambCode || "Sin ubicación",
      parts: ubicacionPartsMap[ambCode] || { ciudad: "", inmueble: "", nivel: "", ambiente: "" },
      ciRaw,
      responsableName: responsableNameOf(ciRaw),
      estadoCons: String(a.estadoConservacion ?? a.estadoconservacion ?? "").trim().toUpperCase() || "—",
      descripcion: a.descripcionActivo ?? a.descripcionactivo ?? "—",
      observaciones: a.observaciones ? String(a.observaciones) : "—",
      estadoLabel: getEstadoAltaBajaLabel(a.estado ?? a.estadoActivo),
    };
  });
};

/**
 * Genera el PDF ficha por activo. Acepta un bloque (slice) con su
 * numeroInicial para el correlativo, subtítulo y nombre de archivo.
 * paginaInicial/totalPaginasProyecto: correlativo de hojas continuo entre
 * bloques (si el bloque 1 termina en la hoja 160, el 2 empieza en la 161).
 * dryRun: solo cuenta hojas exactas sin descargar (no guarda archivo).
 * Retorna { totalPages } para encadenar el siguiente bloque.
 */
export const buildEvaluacionTecnicaPDF = async (rows, { numeroInicial = 1, subtitulo = null, nombreArchivo = null, paginaInicial = 1, totalPaginasProyecto = null, dryRun = false, fotosMap = null } = {}) => {
  if (!rows || rows.length === 0) return;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;

  addLogo(doc);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("INFORME TECNICO", pageWidth / 2, 10, { align: "center" });
  doc.setFontSize(13);
  doc.text("FICHA DE EVALUACION TECNICA", pageWidth / 2, 16, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(subtitulo || `Total activos: ${rows.length}`, pageWidth / 2, 21, { align: "center" });
  doc.setDrawColor(200);
  doc.line(margin, 23, pageWidth - margin, 23);

  let y = 27;

  const checkPage = (needed = 40) => {
    if (y + needed > pageHeight - 15) {
      doc.addPage();
      y = 20;
      addLogo(doc);
    }
  };

  // Fotos: 1) mapa bulk precargado, 2) escaneo bulk bajo demanda,
  // 3) fallback por activo (16 en paralelo). Evita 300 list() por bloque.
  let allFotos = null;
  if (fotosMap && fotosMap.size > 0) {
    allFotos = rows.map((a) => fotosMap.get(String(a.codigoActivo)) || []);
  } else {
    try {
      const bulk = await fetchEvaluacionFotosMap(rows.map((a) => a.codigoActivo));
      if (bulk && bulk.size > 0) {
        allFotos = rows.map((a) => bulk.get(String(a.codigoActivo)) || []);
      }
    } catch {
      // ignorar: va al fallback
    }
  }
  if (!allFotos) {
    allFotos = await mapWithConcurrency(rows, 16, async (a) => {
      try {
        const fotos = await fetchActivoImages(a.codigoActivo);
        return fotos || [];
      } catch {
        return [];
      }
    });
  }

  for (let idx = 0; idx < rows.length; idx++) {
    const a = rows[idx];
    const correlativo = numeroInicial + idx;
    const codigo = a.codigo;

    checkPage(60);

    const headerH = 14;
    doc.setFillColor(16, 70, 140);
    doc.setDrawColor(16, 70, 140);
    doc.rect(margin, y, contentWidth, headerH, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(`${correlativo}. Activo: ${codigo}`, margin + 2, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const direccionLines = doc.splitTextToSize(a.ubicacion, contentWidth - 20);
    doc.text(`Ubicación: ${direccionLines[0]}`, margin + 2, y + 9.5);
    let extraHeaderH = 0;
    if (direccionLines.length > 1) {
      for (let d = 1; d < Math.min(direccionLines.length, 2); d++) {
        doc.text(direccionLines[d], margin + 16, y + 9.5 + d * 3.5);
        extraHeaderH += 3.5;
      }
      doc.rect(margin, y, contentWidth, headerH + extraHeaderH, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text(`${correlativo}. Activo: ${codigo}`, margin + 2, y + 5);
      doc.setFont("helvetica", "normal");
      doc.text(`Ubicación: ${direccionLines[0]}`, margin + 2, y + 9.5);
      for (let d = 1; d < Math.min(direccionLines.length, 2); d++) {
        doc.text(direccionLines[d], margin + 16, y + 9.5 + d * 3.5);
      }
      doc.setTextColor(0, 0, 0);
    } else {
      doc.setTextColor(0, 0, 0);
    }
    y += headerH + extraHeaderH + 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);

    const col1X = margin + 2;
    const col1ValX = margin + 26;
    const col2X = margin + contentWidth / 2 + 2;
    const col2ValX = margin + contentWidth / 2 + 30;
    const lineH = 4;

    const drawTwoCols = (l1, v1, l2, v2) => {
      checkPage(lineH + 4);
      doc.setFont("helvetica", "bold");
      doc.text(l1, col1X, y);
      doc.setFont("helvetica", "normal");
      doc.text(String(v1).slice(0, 40), col1ValX, y);
      doc.setFont("helvetica", "bold");
      doc.text(l2, col2X, y);
      doc.setFont("helvetica", "normal");
      doc.text(String(v2).slice(0, 32), col2ValX, y);
      y += lineH + 1;
    };

    const drawFullWidth = (label, value) => {
      const maxW = contentWidth - 34;
      const lines = doc.splitTextToSize(String(value || "—"), maxW);
      const needed = 4 + lines.length * 3.5;
      checkPage(needed + 2);
      doc.setFont("helvetica", "bold");
      doc.text(label, col1X, y);
      doc.setFont("helvetica", "normal");
      doc.text(lines, col1ValX, y);
      y += lines.length * 3.5 + 1.5;
    };

    drawTwoCols("Rubro:", a.rubroDesc || "—", "Tipo Rubro:", a.tipoDesc || "—");
    drawFullWidth("Descripción:", a.descripcion);
    drawTwoCols("Conservación:", a.estadoCons || "—", "Estado:", a.estadoLabel);
    drawTwoCols("Responsable:", a.responsableName, "Carnet:", a.ciRaw || "—");
    drawTwoCols("Ciudad:", a.parts.ciudad || "—", "Inmueble:", a.parts.inmueble || "—");
    drawTwoCols("Nivel:", a.parts.nivel || "—", "Ambiente:", a.parts.ambiente || "—");
    drawFullWidth("Observaciones:", a.observaciones);

    y += 1;
    doc.setDrawColor(220);
    doc.line(margin, y, pageWidth - margin, y);
    y += 3;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("FOTOGRAFIA:", margin + 2, y);
    y += 4;

    const fotos = allFotos[idx] || [];

    if (!fotos || fotos.length === 0) {
      checkPage(5 + 34); // "Sin fotos" + firma en la misma página
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(120);
      doc.text("Sin fotos registradas", margin + 2, y);
      doc.setTextColor(0);
      y += 5;
    } else {
      const imgW = 38;
      const imgH = 28;
      const gap = 2;
      const perRow = Math.floor(contentWidth / (imgW + gap));
      let col = 0;

      // En conteo (dryRun) no se descargan las imágenes: el diseño usa
      // tamaño fijo por foto, así el total de hojas es exacto e igual.
      const base64List = dryRun ? fotos.map(() => null) : await mapWithConcurrency(fotos, 12, (f) => urlToBase64(f.url));

      // Reserva para que la última fila de fotos + conteo + FIRMA DEL PERITO
      // queden siempre en la misma página (la firma nunca queda sola abajo).
      const FIRMA_RESERVA = 36;
      for (let fIdx = 0; fIdx < fotos.length; fIdx++) {
        const esUltimaFila = fIdx + perRow >= fotos.length;
        const need = imgH + 8 + (esUltimaFila ? FIRMA_RESERVA : 0);
        if (col === 0 && y + need > pageHeight - 10) {
          doc.addPage();
          y = 20;
          addLogo(doc);
        }
        const base64 = base64List[fIdx];
        const x = margin + 2 + col * (imgW + gap);
        if (base64) {
          try {
            const fmt = fotos[fIdx].name.toLowerCase().endsWith(".png") ? "PNG" : "JPEG";
            doc.addImage(base64, fmt, x, y, imgW, imgH);
          } catch {
            doc.setDrawColor(200);
            doc.rect(x, y, imgW, imgH);
            doc.setFontSize(5);
            doc.text("Error imagen", x + 2, y + 5);
          }
        } else {
          doc.setDrawColor(200);
          doc.rect(x, y, imgW, imgH);
        }
        col++;
        if (col >= perRow) {
          col = 0;
          y += imgH + 2;
        }
      }
      if (col !== 0) y += imgH + 2;
      if (y + 6 > pageHeight - 10) {
        doc.addPage();
        y = 20;
        addLogo(doc);
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(100);
      doc.text(`${fotos.length} foto(s)`, margin + 2, y);
      doc.setTextColor(0);
      y += 5;
    }

    // Espacio prudente para firmar + título FIRMA DEL PERITO
    // (el espacio ya viene reservado: siempre cae junto a las fotos)
    y += 14;
    doc.setDrawColor(100);
    doc.line(pageWidth / 2 - 30, y, pageWidth / 2 + 30, y);
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("FIRMA DEL PERITO", pageWidth / 2, y, { align: "center" });
    y += 4;

    y += 1;
    if (idx < rows.length - 1) {
      doc.setDrawColor(230);
      doc.line(margin, y, pageWidth - margin, y);
      y += 3;
    }

    if (y > pageHeight - 20 && idx < rows.length - 1) {
      doc.addPage();
      y = 20;
      addLogo(doc);
    }
  }

  const totalPages = doc.getNumberOfPages();
  const totalPagesShown = totalPaginasProyecto ?? totalPages;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    if (i > 1) addLogo(doc);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text(`Página ${paginaInicial + i - 1} de ${totalPagesShown}  |  FICHA DE EVALUACION TECNICA - Órgano Judicial`, pageWidth / 2, pageHeight - 6, { align: "center" });
  }

  if (!dryRun) {
    doc.save(nombreArchivo || `Ficha_Evaluacion_Tecnica_${new Date().toISOString().slice(0, 10)}.pdf`);
  }
  return { totalPages };
};

const EXCEL_HEADERS = [
  "N°", "Código Activo", "Rubro", "Tipo Rubro", "Descripción", "Conservación",
  "Responsable", "Carnet", "Estado", "Ciudad", "Inmueble",
  "Nivel", "Ambiente", "Observaciones",
];

/**
 * Genera el Excel tabular. Acepta un bloque (slice) con su numeroInicial
 * para el correlativo, subtítulo y nombre de archivo.
 */
export const buildEvaluacionTecnicaExcel = async (rows, { numeroInicial = 1, subtitulo = null, nombreArchivo = null } = {}) => {
  if (!rows || rows.length === 0) return;

  const dateStr = new Date().toISOString().slice(0, 10);
  const body = rows.map((a, idx) => [
    numeroInicial + idx,
    a.codigo,
    clean(a.rubroDesc),
    clean(a.tipoDesc),
    clean(a.descripcion),
    a.estadoCons || "—",
    clean(a.responsableName),
    a.ciRaw || "—",
    a.estadoLabel,
    clean(a.parts.ciudad),
    clean(a.parts.inmueble),
    clean(a.parts.nivel),
    clean(a.parts.ambiente),
    clean(a.observaciones),
  ]);

  const sheetData = [
    ["FICHA DE EVALUACION TECNICA - ÓRGANO JUDICIAL"],
    [subtitulo || `Total activos: ${rows.length}`],
    [`Fecha: ${dateStr}`],
    [],
    EXCEL_HEADERS,
    ...body,
  ];

  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  ws["!cols"] = [{ wch: 6 }, { wch: 16 }, { wch: 28 }, { wch: 30 }, { wch: 70 }, { wch: 14 }, { wch: 32 }, { wch: 16 }, { wch: 10 }, { wch: 24 }, { wch: 30 }, { wch: 24 }, { wch: 30 }, { wch: 70 }];
  ws["!pageSetup"] = { orientation: "landscape", paperSize: 1, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  ws["!margins"] = { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "EvaluacionTecnica");
  XLSX.writeFile(wb, nombreArchivo || `Ficha_Evaluacion_Tecnica_${dateStr}.xlsx`);
};
