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

const LOGO_W = 48;
const LOGO_H = LOGO_W * (57 / 256);
const addLogo = (doc) => {
  try {
    doc.addImage(LOGO_JPG_DATA_URL, "JPEG", 14, 8, LOGO_W, LOGO_H);
  } catch { }
};

export const useReporteInventarioGeneral = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    try {
      toast({ title: "Generando Inventario General", description: "Cargando catálogos..." });

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
      (niveles || []).forEach((n) => { nivelMap[String(n.codigonivel ?? "").trim()] = n; });
      const inmuebleMap = {};
      (inmuebles || []).forEach((i) => { inmuebleMap[String(i.codigoinmueble ?? "").trim()] = i; });
      const ciudadMap = {};
      (ciudades || []).forEach((c) => { ciudadMap[String(c.codigociudad ?? "").trim()] = c; });

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

      toast({ title: "Cargando activos", description: "Obteniendo activos con ultimoregistro=1 ordenados por código..." });

      let allActivos = [];
      let from = 0;
      const FETCH_CHUNK = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("act_activos")
          .select(ACTIVO_COLUMNS)
          .eq("ultimoregistro", 1)
          .order("codigoactivo", { ascending: true })
          .range(from, from + FETCH_CHUNK - 1);
        if (error) throw error;
        const batch = toCamelCaseArray(data || []);
        if (batch.length === 0) break;
        allActivos = allActivos.concat(batch);
        if (batch.length < FETCH_CHUNK) break;
        from += FETCH_CHUNK;
        if (allActivos.length > 60000) break;
        await new Promise((r) => setTimeout(r, 0));
      }

      if (allActivos.length === 0) {
        toast({ title: "Sin datos", description: "No hay activos con ultimoregistro=1.", variant: "destructive" });
        return;
      }

      // Asegurar orden ascendente numérico por codigoActivo (por si DB devuelve string)
      allActivos.sort((a, b) => {
        const codA = String(a.codigoActivo ?? "").trim();
        const codB = String(b.codigoActivo ?? "").trim();
        const numA = Number(codA.replace(/\D/g, ""));
        const numB = Number(codB.replace(/\D/g, ""));
        if (numA && numB && numA !== numB) return numA - numB;
        return codA.localeCompare(codB, "es", { numeric: true });
      });

      const body = allActivos.map((a) => {
        const tipoDesc = tipoRubroDescMap[a.tipoRubroAct] ?? tipoRubroDescMap[String(a.tipoRubroAct)] ?? "—";
        const rubroDesc = rubroFromTipo[a.tipoRubroAct] ?? rubroFromTipo[String(a.tipoRubroAct)] ?? "—";
        const ambCode = String(a.codigoAmbiente ?? "").trim();
        const ubicacion = ubicacionJerarquiaMap[ambCode] || ambCode || "—";
        const responsableName = resolveResponsableName(a.cirun);
        const ci = String(a.cirun ?? "").trim() || "—";
        const codigoFormateado = a.codigoActivo != null ? `OJ-02-${a.codigoActivo}` : "—";
        const descripcion = String(a.descripcionActivo ?? a.descripcionactivo ?? "—").replace(/\s+/g, " ").trim() || "—";
        return [codigoFormateado, rubroDesc, tipoDesc, descripcion, ubicacion, responsableName, ci];
      });

      toast({ title: "Generando PDF", description: `Construyendo reporte con ${body.length} activos...` });

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      addLogo(doc);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("INVENTARIO GENERAL - ÓRGANO JUDICIAL", pageWidth / 2, 16, { align: "center" });

      autoTable(doc, {
        startY: 26,
        head: [["Código Activo", "Rubro", "Tipo Rubro", "Descripción del Activo", "Ubicación", "Responsable", "Carnet"]],
        body,
        theme: "striped",
        styles: { font: "helvetica", fontSize: 6.5, cellPadding: 1.2, overflow: "linebreak", valign: "top" },
        headStyles: { fillColor: [16, 70, 140], textColor: [255, 255, 255], halign: "center", valign: "middle", fontSize: 7, fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 24, halign: "center", fontStyle: "bold" },
          1: { cellWidth: 28, halign: "left" },
          2: { cellWidth: 28, halign: "left" },
          3: { cellWidth: "auto", halign: "left" },
          4: { cellWidth: 52, halign: "left" },
          5: { cellWidth: 36, halign: "left" },
          6: { cellWidth: 20, halign: "center" },
        },
        margin: { left: 10, right: 10, top: 26 },
        didParseCell: (data) => {
          // Mantener alineación consistente
          if (data.section === "body" && data.column.index === 3) data.cell.styles.halign = "left";
        },
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

      const dateStr = new Date().toISOString().slice(0, 10);
      doc.save(`Inventario_General_ultimoregistro1_${dateStr}.pdf`);
      toast({ title: "Reporte generado", description: `Se exportaron ${body.length} activos ordenados por código.` });
    } catch (err) {
      console.error("Error generando Inventario General", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
