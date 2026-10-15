import { useState, useCallback } from "react";
import { jsPDF } from "jspdf";
import { supabase } from "@/lib/supabase";
import { getCachedCatalog } from "@/lib/catalogCache";
import { toCamelCaseArray } from "@/lib/mapFields";
import { useToast } from "@/hooks/use-toast";
import { LOGO_JPG_DATA_URL } from "@/lib/logoJpgBase64";
import { ACTIVO_COLUMNS } from "@/lib/activoColumns";
import { normalizeCi, normalizeCiLoose, getCiPrefix } from "../constants/inventarioConstants";
import { fetchActivoImages } from "@/inventario/services/inventarioService";

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

const normTxt = (s) =>
  String(s || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Rubros excluidos: edificaciones, biblioteca, terrenos
const RUBROS_EXCLUIDOS = ["BIBLIOTEC", "TERRENO", "EDIFICAC"];

const isTrueish = (v) => {
  if (v === true || v === 1) return true;
  const s = String(v ?? "").trim().toUpperCase();
  return s === "TRUE" || s === "1" || s === "T" || s === "SI" || s === "SÍ";
};

/**
 * Reporte ACTIVOS OBSOLETOS (PDF) — PRODUCTO 4.
 * Criterio: estado=1 AND ultimoregistro=1 AND estadoconservacion=MALO
 * AND esactivo=true, excluyendo rubros edificaciones, biblioteca y terrenos.
 * Formato ficha por activo como la Evaluación Técnica (sin cotizaciones,
 * respaldos ni factores). Con fotografía. Orden: codigoactivo ASC.
 */
export const useReporteObsoletosP4 = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    try {
      toast({ title: "Generando Activos Obsoletos", description: "Cargando catálogos..." });

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

      toast({ title: "Cargando activos", description: "Obteniendo activos obsoletos (MALO, esactivo=true)..." });

      let allActivos = [];
      {
        let from = 0;
        const FETCH_CHUNK = 1000;
        while (true) {
          const { data, error } = await supabase
            .from("act_activos")
            .select(`${ACTIVO_COLUMNS},esactivo`)
            .eq("estado", 1)
            .eq("ultimoregistro", 1)
            .eq("estadoconservacion", "MALO")
            .eq("esactivo", true)
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
      // Refuerzo en cliente + exclusión de rubros edificaciones/biblioteca/terrenos
      allActivos = allActivos.filter((a) => {
        const est = a.estado ?? a.estadoActivo;
        const esAlta =
          est === 1 || est === true
            ? true
            : ["1", "TRUE", "T", "ALTA"].includes(String(est ?? "").trim().toUpperCase());
        if (!esAlta) return false;
        if (String(a.ultimoRegistro ?? a.ultimoregistro ?? "").trim() !== "1") return false;
        if (String(a.estadoConservacion ?? a.estadoconservacion ?? "").trim().toUpperCase() !== "MALO") return false;
        if (!isTrueish(a.esactivo ?? a.esActivo)) return false;
        const tipoRubroAct = a.tipoRubroAct ?? a.tiporubroact;
        const rubroDesc = rubroFromTipo[tipoRubroAct] ?? rubroFromTipo[String(tipoRubroAct)] ?? "";
        if (RUBROS_EXCLUIDOS.some((k) => normTxt(rubroDesc).includes(k))) return false;
        return true;
      });
      allActivos.sort((a, b) => Number(a.codigoActivo ?? a.codigoactivo ?? 0) - Number(b.codigoActivo ?? b.codigoactivo ?? 0));

      if (allActivos.length === 0) {
        toast({ title: "Sin datos", description: "No hay activos obsoletos con ese criterio.", variant: "destructive" });
        return;
      }

      toast({ title: "Generando PDF", description: `Construyendo fichas de ${allActivos.length} activos...` });

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
      doc.text("ACTIVOS OBSOLETOS", pageWidth / 2, 16, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Total activos obsoletos: ${allActivos.length}`, pageWidth / 2, 21, { align: "center" });
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

      const allFotos = await mapWithConcurrency(allActivos, 8, async (a) => {
        try {
          const codigo = a.codigoActivo ?? a.codigoactivo;
          const fotos = await fetchActivoImages(codigo);
          return fotos || [];
        } catch {
          return [];
        }
      });

      for (let idx = 0; idx < allActivos.length; idx++) {
        const a = allActivos[idx];
        const codigoActivo = a.codigoActivo ?? a.codigoactivo;
        const tipoRubroAct = a.tipoRubroAct ?? a.tiporubroact;
        const rubroDesc = rubroFromTipo[tipoRubroAct] ?? rubroFromTipo[String(tipoRubroAct)] ?? "—";
        const tipoDesc = tipoRubroDescMap[tipoRubroAct] ?? tipoRubroDescMap[String(tipoRubroAct)] ?? "—";
        const ambCode = String(a.codigoAmbiente ?? a.codigoambiente ?? "").trim();
        const ubicacion = ubicacionMap[ambCode] || ambCode || "Sin ubicación";
        const parts = ubicacionPartsMap[ambCode] || { ciudad: "", inmueble: "", nivel: "", ambiente: "" };
        const ciRaw = String(a.cirun ?? "").trim();
        const estadoCons = String(a.estadoConservacion ?? a.estadoconservacion ?? "").trim().toUpperCase() || "—";
        const codigo = codigoActivo != null ? `OJ-02-${codigoActivo}` : "—";

        checkPage(60);

        const headerH = 14;
        doc.setFillColor(16, 70, 140);
        doc.setDrawColor(16, 70, 140);
        doc.rect(margin, y, contentWidth, headerH, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text(`${idx + 1}. Activo: ${codigo}`, margin + 2, y + 5);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        const direccionLines = doc.splitTextToSize(ubicacion, contentWidth - 20);
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
          doc.text(`${idx + 1}. Activo: ${codigo}`, margin + 2, y + 5);
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

        drawTwoCols("Rubro:", rubroDesc || "—", "Tipo Rubro:", tipoDesc || "—");
        drawFullWidth("Descripción:", a.descripcionActivo ?? a.descripcionactivo ?? "—");
        drawTwoCols("Conservación:", estadoCons || "—", "Estado:", getEstadoAltaBajaLabel(a.estado ?? a.estadoActivo));
        drawTwoCols("Responsable:", responsableNameOf(ciRaw), "Carnet:", ciRaw || "—");
        drawTwoCols("Ciudad:", parts.ciudad || "—", "Inmueble:", parts.inmueble || "—");
        drawTwoCols("Nivel:", parts.nivel || "—", "Ambiente:", parts.ambiente || "—");
        drawFullWidth("Observaciones:", a.observaciones ? String(a.observaciones) : "—");

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

          const base64List = await mapWithConcurrency(fotos, 6, (f) => urlToBase64(f.url));

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
        if (idx < allActivos.length - 1) {
          doc.setDrawColor(230);
          doc.line(margin, y, pageWidth - margin, y);
          y += 3;
        }

        if (y > pageHeight - 20 && idx < allActivos.length - 1) {
          doc.addPage();
          y = 20;
          addLogo(doc);
        }
      }

      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        if (i > 1) addLogo(doc);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(120);
        doc.text(`Página ${i} de ${totalPages}  |  ACTIVOS OBSOLETOS - Órgano Judicial`, pageWidth / 2, pageHeight - 6, { align: "center" });
      }

      doc.save(`Activos_Obsoletos_P4_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast({ title: "Reporte generado", description: `Se exportaron ${allActivos.length} activos obsoletos.` });
    } catch (err) {
      console.error("Error generando Activos Obsoletos", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
