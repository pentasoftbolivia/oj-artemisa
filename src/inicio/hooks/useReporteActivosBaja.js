import { useState, useCallback } from "react";
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

const LOGO_W = 32;
const LOGO_H = LOGO_W * (57 / 256);
const addLogo = (doc) => {
  try {
    doc.addImage(LOGO_JPG_DATA_URL, "JPEG", 14, 8, LOGO_W, LOGO_H);
  } catch {}
};

/**
 * Reporte ACTIVOS DE BAJA (PDF) — PRODUCTO 3.
 * Criterio: ultimoregistro=1 AND (estado=0 OR esactivo=false).
 * Si la columna esactivo no existe en BD, se usa solo estado=0 (con aviso).
 * Columnas: N°, Código Activo, Rubro, Tipo Rubro, Descripción,
 * Ubicación, Responsable, Carnet. Orden: codigoactivo ASC.
 */
export const useReporteActivosBaja = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    try {
      toast({ title: "Generando Activos de Baja", description: "Cargando catálogos..." });

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
      (ambientes || []).forEach((a) => {
        const code = String(a.codigoambiente ?? "").trim();
        if (!code) return;
        const nivel = nivelMap[String(a.codigonivel ?? "").trim()];
        const inmueble = nivel ? inmuebleMap[String(nivel.codigoinmueble ?? "").trim()] : null;
        const ciudad = inmueble ? ciudadMap[String(inmueble.codigociudad ?? "").trim()] : null;
        ubicacionMap[code] =
          [ciudad?.descripcion, inmueble?.inmueble, nivel?.nivel, a.ambiente]
            .map((s) => (s || "").trim())
            .filter(Boolean)
            .join(" / ") || code;
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

      toast({ title: "Cargando activos", description: "Obteniendo activos de baja (estado=0 o esactivo=false)..." });

      const fetchByEstado = async () => {
        let rows = [];
        let from = 0;
        const FETCH_CHUNK = 1000;
        while (true) {
          const { data, error } = await supabase
            .from("act_activos")
            .select(ACTIVO_COLUMNS)
            .eq("ultimoregistro", 1)
            .eq("estado", 0)
            .order("codigoactivo", { ascending: true })
            .range(from, from + FETCH_CHUNK - 1);
          if (error) throw error;
          const batch = toCamelCaseArray(data || []);
          if (batch.length === 0) break;
          rows = rows.concat(batch);
          if (batch.length < FETCH_CHUNK) break;
          from += FETCH_CHUNK;
          if (rows.length > 100000) break;
          await new Promise((r) => setTimeout(r, 0));
        }
        return rows;
      };

      const fetchByEsactivo = async () => {
        let rows = [];
        let from = 0;
        const FETCH_CHUNK = 1000;
        while (true) {
          const { data, error } = await supabase
            .from("act_activos")
            .select(ACTIVO_COLUMNS)
            .eq("ultimoregistro", 1)
            .eq("esactivo", false)
            .order("codigoactivo", { ascending: true })
            .range(from, from + FETCH_CHUNK - 1);
          if (error) throw error;
          const batch = toCamelCaseArray(data || []);
          if (batch.length === 0) break;
          rows = rows.concat(batch);
          if (batch.length < FETCH_CHUNK) break;
          from += FETCH_CHUNK;
          if (rows.length > 100000) break;
          await new Promise((r) => setTimeout(r, 0));
        }
        return rows;
      };

      const rowIdOf = (a) => String(a.codigoActivoInterno ?? a.codigoactivointerno ?? `${a.codigoActivo ?? a.codigoactivo}-${a.codigoTransaccion ?? a.codigotransaccion ?? ""}`);

      const porEstado = await fetchByEstado();
      let porEsactivo = [];
      try {
        porEsactivo = await fetchByEsactivo();
      } catch (err) {
        if (!String(err?.message || "").toLowerCase().includes("esactivo")) throw err;
        console.warn("[ActivosBaja] columna esactivo no existe, usando solo estado=0");
        toast({ title: "Aviso", description: "Columna esactivo no encontrada: se filtra solo por estado=0." });
      }
      // Unión OR sin duplicados
      const seen = new Set(porEstado.map(rowIdOf));
      let allActivos = [...porEstado];
      porEsactivo.forEach((a) => {
        const id = rowIdOf(a);
        if (!seen.has(id)) { seen.add(id); allActivos.push(a); }
      });
      // Refuerzo en cliente: estado 0/false/BAJA **O** esactivo false/0
      allActivos = allActivos.filter((a) => {
        const est = String(a.estado ?? a.estadoActivo ?? "").trim().toUpperCase();
        const esBaja = est === "0" || est === "FALSE" || est === "BAJA";
        const rawEa = a.esactivo ?? a.esActivo;
        let inactivo = false;
        if (rawEa != null && String(rawEa).trim() !== "") {
          const ea = String(rawEa).trim().toUpperCase();
          inactivo = ea === "FALSE" || ea === "0" || ea === "F";
        }
        return esBaja || inactivo;
      });
      allActivos.sort((a, b) => Number(a.codigoActivo ?? a.codigoactivo ?? 0) - Number(b.codigoActivo ?? b.codigoactivo ?? 0));

      if (allActivos.length === 0) {
        toast({ title: "Sin datos", description: "No hay activos de baja con ese criterio.", variant: "destructive" });
        return;
      }

      const body = allActivos.map((a, idx) => {
        const codigoActivo = a.codigoActivo ?? a.codigoactivo;
        const tipoRubroAct = a.tipoRubroAct ?? a.tiporubroact;
        const rubroDesc = rubroFromTipo[tipoRubroAct] ?? rubroFromTipo[String(tipoRubroAct)] ?? "—";
        const tipoDesc = tipoRubroDescMap[tipoRubroAct] ?? tipoRubroDescMap[String(tipoRubroAct)] ?? "—";
        const ambCode = String(a.codigoAmbiente ?? a.codigoambiente ?? "").trim();
        const ciRaw = String(a.cirun ?? "").trim();
        return [
          String(idx + 1),
          codigoActivo != null ? `OJ-02-${codigoActivo}` : "—",
          String(rubroDesc || "—"),
          String(tipoDesc || "—"),
          String(a.descripcionActivo ?? a.descripcionactivo ?? "—"),
          String(ubicacionMap[ambCode] || ambCode || "—"),
          String(responsableNameOf(ciRaw)),
          ciRaw || "—",
        ];
      });

      toast({ title: "Generando PDF", description: `Construyendo reporte con ${allActivos.length} activos...` });

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      addLogo(doc);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("ACTIVOS DE BAJA - ÓRGANO JUDICIAL", pageWidth / 2, 16, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Total activos de baja: ${allActivos.length}`, pageWidth / 2, 21, { align: "center" });

      autoTable(doc, {
        startY: 26,
        head: [["N°", "Código Activo", "Rubro", "Tipo Rubro", "Descripción", "Ubicación", "Responsable", "Carnet"]],
        body,
        foot: [["", "", "", "", "", "", "TOTAL", String(allActivos.length)]],
        showFoot: "lastPage",
        theme: "striped",
        styles: { font: "helvetica", fontSize: 7, cellPadding: 1.6, overflow: "linebreak", valign: "middle" },
        headStyles: { fillColor: [16, 70, 140], textColor: [255, 255, 255], halign: "center", fontStyle: "bold", fontSize: 7 },
        footStyles: { fillColor: [230, 240, 255], textColor: [16, 70, 140], halign: "center", fontStyle: "bold", fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 24, halign: "center" },
          2: { cellWidth: 32, halign: "left" },
          3: { cellWidth: 34, halign: "left" },
          4: { halign: "left" },
          5: { cellWidth: 52, halign: "left" },
          6: { cellWidth: 38, halign: "left" },
          7: { cellWidth: 22, halign: "center" },
        },
        margin: { top: 26 },
      });

      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        if (i > 1) addLogo(doc);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80);
        doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 7, { align: "center" });
      }

      doc.save("Activos_De_Baja.pdf");
      toast({ title: "Reporte generado", description: `Se exportaron ${allActivos.length} activos de baja.` });
    } catch (err) {
      console.error("Error generando Activos de Baja", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
