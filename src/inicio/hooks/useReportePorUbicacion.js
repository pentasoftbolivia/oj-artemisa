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

// Orden exacto solicitado - normalizado a upper para matching
const CIUDAD_ORDEN = [
  "EL ALTO",
  "LA PAZ",
  "LA PAZ ZONA SUR",
  "CARANAVI",
  "VIACHA",
  "ACHACACHI",
  "CHULUMANI",
  "COPACABANA",
  "SICA SICA",
  "COROICO",
  "PUCARANI",
  "APOLO",
  "PATACAMAYA",
  "INQUISIVI",
  "CHUMA",
  "ACHOCALLA",
  "GUAQUI",
  "SORATA",
  "CORO CORO",
  "MOCO MOCO",
  "CARABUCO",
  "IXIAMAS",
  "LURIBAY",
  "GUANAY",
  "PUERTO ACOSTA",
  "CHARAZANI",
  "QUIME",
  "LAJA",
  "PALOS BLANCOS",
  "SAN ANDRES DE MACHACA",
  "LA ASUNTA",
  "SAPAHAQUI",
  "COLQUIRI",
];
const ciudadOrdenMap = {};
CIUDAD_ORDEN.forEach((name, idx) => { ciudadOrdenMap[name] = idx; });

export const useReportePorUbicacion = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    try {
      toast({ title: "Generando Reporte por Ubicación", description: "Cargando catálogos..." });

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
      const ciudadPorAmbiente = {};
      (ambientes || []).forEach((a) => {
        const code = String(a.codigoambiente ?? "").trim();
        if (!code) return;
        const nivel = nivelMap[String(a.codigonivel ?? "").trim()];
        const inmuebleCode = String(nivel?.codigoinmueble ?? "").trim();
        const inmueble = nivel ? inmuebleMap[inmuebleCode] : null;
        const ciudad = inmueble ? ciudadMap[String(inmueble.codigociudad ?? "").trim()] : null;
        let ciudadDesc = String(ciudad?.descripcion ?? ciudad?.ciudad ?? "").trim().toUpperCase();
        // Reglas especiales solo para reporte POR UBICACION:
        // - codigoinmueble=2309 de LA PAZ se cuenta en ACHOCALLA
        // - codigoinmueble=2327 de LA PAZ se cuenta en LAJA
        // - codigoinmueble=2341 de LA PAZ se cuenta en PALOS BLANCOS
        // - codigoinmueble=2371 de LA PAZ se cuenta en SAN ANDRES DE MACHACA
        const esLaPaz2309 = inmuebleCode === "2309" && ciudadDesc === "LA PAZ";
        const esLaPaz2327 = inmuebleCode === "2327" && ciudadDesc === "LA PAZ";
        const esLaPaz2341 = inmuebleCode === "2341" && ciudadDesc === "LA PAZ";
        const esLaPaz2371 = inmuebleCode === "2371" && ciudadDesc === "LA PAZ";
        if (esLaPaz2309) ciudadDesc = "ACHOCALLA";
        else if (esLaPaz2327) ciudadDesc = "LAJA";
        else if (esLaPaz2341) ciudadDesc = "PALOS BLANCOS";
        else if (esLaPaz2371) ciudadDesc = "SAN ANDRES DE MACHACA";
        ciudadPorAmbiente[code] = ciudadDesc || "SIN CIUDAD";
        const ciudadLabelUbic = esLaPaz2309 ? "ACHOCALLA" : esLaPaz2327 ? "LAJA" : esLaPaz2341 ? "PALOS BLANCOS" : esLaPaz2371 ? "SAN ANDRES DE MACHACA" : ciudad?.descripcion;
        ubicacionJerarquiaMap[code] =
          [ciudadLabelUbic, inmueble?.inmueble, nivel?.nivel, a.ambiente]
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

      toast({ title: "Cargando activos", description: "Obteniendo activos con ultimoregistro=1..." });

      let allActivos = [];
      let from = 0;
      const FETCH_CHUNK = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("act_activos")
          .select(ACTIVO_COLUMNS)
          .eq("ultimoregistro", 1).order("codigoactivointerno", { ascending: true }).range(from, from + FETCH_CHUNK - 1);
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

      // Ordenar por Ciudad según CIUDAD_ORDEN, luego por código activo ascendente
      allActivos.sort((a, b) => {
        const ambA = String(a.codigoAmbiente ?? "").trim();
        const ambB = String(b.codigoAmbiente ?? "").trim();
        const ciuA = (ciudadPorAmbiente[ambA] || "SIN CIUDAD").toUpperCase();
        const ciuB = (ciudadPorAmbiente[ambB] || "SIN CIUDAD").toUpperCase();
        const idxA = ciudadOrdenMap[ciuA] ?? 999;
        const idxB = ciudadOrdenMap[ciuB] ?? 999;
        if (idxA !== idxB) return idxA - idxB;
        if (idxA === 999 && idxB === 999) {
          const cmpCiu = ciuA.localeCompare(ciuB, "es");
          if (cmpCiu !== 0) return cmpCiu;
        }
        const codA = String(a.codigoActivo ?? "").trim();
        const codB = String(b.codigoActivo ?? "").trim();
        const numA = Number(codA.replace(/\D/g, ""));
        const numB = Number(codB.replace(/\D/g, ""));
        if (numA && numB && numA !== numB) return numA - numB;
        return codA.localeCompare(codB, "es", { numeric: true });
      });

      // Agrupar por ciudad manteniendo orden CIUDAD_ORDEN
      const grupos = new Map();
      allActivos.forEach((a) => {
        const ambCode = String(a.codigoAmbiente ?? "").trim();
        const ciudad = (ciudadPorAmbiente[ambCode] || "SIN CIUDAD").toUpperCase();
        const label = ciudad === "SIN CIUDAD" ? "SIN CIUDAD" : CIUDAD_ORDEN.find((c) => c === ciudad) || ciudad;
        if (!grupos.has(label)) grupos.set(label, []);
        grupos.get(label).push(a);
      });
      const ordenCiudades = [
        ...CIUDAD_ORDEN.filter((c) => grupos.has(c)),
        ...[...grupos.keys()].filter((c) => !ciudadOrdenMap.hasOwnProperty(c)).sort((a, b) => a.localeCompare(b, "es")),
      ];

      toast({ title: "Generando PDF", description: `Construyendo reporte por ubicación con ${allActivos.length} activos en ${ordenCiudades.length} ciudades...` });

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      addLogo(doc);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("REPORTE POR UBICACIÓN - ÓRGANO JUDICIAL", pageWidth / 2, 16, { align: "center" });

      let currentY = 26;
      // Resumen por ciudad - totales
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(16, 70, 140);
      doc.text("RESUMEN POR CIUDAD", pageWidth / 2, currentY, { align: "center" });
      currentY += 4;
      const resumenBody = ordenCiudades.map((c, idx) => [String(idx + 1), c, String((grupos.get(c) || []).length)]);
      resumenBody.push(["", "TOTAL GENERAL", String(allActivos.length)]);
      const resumenTableWidth = 12 + 70 + 30; // 112mm
      const resumenMarginLeft = (pageWidth - resumenTableWidth) / 2;
      autoTable(doc, {
        startY: currentY,
        head: [["#", "Ciudad", "Total Activos"]],
        body: resumenBody,
        theme: "striped",
        tableWidth: resumenTableWidth,
        styles: { font: "helvetica", fontSize: 7, cellPadding: 1.6, halign: "center", valign: "middle" },
        headStyles: { fillColor: [16, 70, 140], textColor: [255, 255, 255], halign: "center", fontStyle: "bold", fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 12, halign: "center" },
          1: { cellWidth: 70, halign: "left" },
          2: { cellWidth: 30, halign: "center", fontStyle: "bold" },
        },
        margin: { left: resumenMarginLeft, right: resumenMarginLeft, top: 26 },
        didParseCell: (data) => {
          if (data.row.index === resumenBody.length - 1) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = [230, 240, 255];
          }
        },
      });
      currentY = doc.lastAutoTable.finalY + 8;

      const headRow = [["Código Activo", "Rubro", "Tipo Rubro", "Descripción del Activo", "Ubicación", "Responsable", "Carnet"]];

      for (let gIdx = 0; gIdx < ordenCiudades.length; gIdx++) {
        const ciudad = ordenCiudades[gIdx];
        const itemsCiudad = grupos.get(ciudad) || [];
        const bodyCiudad = itemsCiudad.map((a) => {
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

        // Verificar espacio para subtítulo + header tabla (~14mm). Si no cabe, nueva página
        if (currentY + 14 > pageHeight - 12) {
          doc.addPage();
          currentY = 26;
        }

        // Subtítulo ciudad
        doc.setFillColor(16, 70, 140);
        doc.rect(10, currentY, pageWidth - 20, 8, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text(`${ciudad}  —  ${bodyCiudad.length} activos`, 12, currentY + 5.2);
        currentY += 10;

        autoTable(doc, {
          startY: currentY,
          head: headRow,
          body: bodyCiudad,
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
            if (data.section === "body" && data.column.index === 3) data.cell.styles.halign = "left";
          },
        });

        currentY = doc.lastAutoTable.finalY + 6;
        // Ceder event loop cada 5 ciudades para no bloquear UI
        if (gIdx % 5 === 4) await new Promise((r) => setTimeout(r, 0));
      }

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
      doc.save(`Reporte_Por_Ubicacion_${dateStr}.pdf`);
      toast({ title: "Reporte generado", description: `Se exportaron ${allActivos.length} activos en ${ordenCiudades.length} ciudades.` });
    } catch (err) {
      console.error("Error generando Reporte por Ubicación", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
