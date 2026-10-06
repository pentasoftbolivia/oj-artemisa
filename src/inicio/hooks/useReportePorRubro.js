import { useState, useCallback } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/lib/supabase";
import { getCachedCatalog } from "@/lib/catalogCache";
import { toCamelCaseArray } from "@/lib/mapFields";
import { useToast } from "@/hooks/use-toast";
import { LOGO_JPG_DATA_URL } from "@/lib/logoJpgBase64";
import { ACTIVO_COLUMNS } from "@/lib/activoColumns";
import { CIUDADES_EXCEPCION_SET } from "../constants/inventarioConstants";

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

/**
 * Reporte por Rubro (PDF): nombre del rubro + total de activos por rubro,
 * con la misma lógica del Inventario General:
 * - ultimoregistro=1
 * - estadoinventario no vacío, excepto ciudades excepción (traen todo con ultimoregistro=1)
 * - excluye rubros BIBLIOTECAS, EDIFICACIONES y TERRENOS
 */
export const useReportePorRubro = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    try {
      toast({ title: "Generando Reporte por Rubro", description: "Cargando catálogos..." });

      const [rubros, tipoRubros, ambientes, ciudades, inmuebles, niveles] = await Promise.all([
        getCachedCatalog("act_rubro"),
        getCachedCatalog("act_tiporubro"),
        getCachedCatalog("act_ambiente"),
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
      (tipoRubros || []).forEach((t) => {
        rubroFromTipo[t.tiporubroact] = rubroDescMap[t.codigorubroact];
        rubroFromTipo[String(t.tiporubroact)] = rubroDescMap[t.codigorubroact];
      });

      const nivelMap = {};
      (niveles || []).forEach((n) => { nivelMap[String(n.codigonivel ?? "").trim()] = n; });
      const inmuebleMap = {};
      (inmuebles || []).forEach((i) => { inmuebleMap[String(i.codigoinmueble ?? "").trim()] = i; });
      const ciudadMap = {};
      (ciudades || []).forEach((c) => { ciudadMap[String(c.codigociudad ?? "").trim()] = c; });

      const ciudadPorAmbiente = {};
      (ambientes || []).forEach((a) => {
        const code = String(a.codigoambiente ?? "").trim();
        if (!code) return;
        const nivel = nivelMap[String(a.codigonivel ?? "").trim()];
        const inmuebleCode = String(nivel?.codigoinmueble ?? "").trim();
        const inmueble = nivel ? inmuebleMap[inmuebleCode] : null;
        const ciudad = inmueble ? ciudadMap[String(inmueble.codigociudad ?? "").trim()] : null;
        let ciudadDesc = String(ciudad?.descripcion ?? "").trim().toUpperCase();
        if (inmuebleCode === "2309" && ciudadDesc === "LA PAZ") ciudadDesc = "ACHOCALLA";
        else if (inmuebleCode === "2327" && ciudadDesc === "LA PAZ") ciudadDesc = "LAJA";
        else if (inmuebleCode === "2341" && ciudadDesc === "LA PAZ") ciudadDesc = "PALOS BLANCOS";
        else if (inmuebleCode === "2371" && ciudadDesc === "LA PAZ") ciudadDesc = "SAN ANDRES DE MACHACA";
        ciudadPorAmbiente[code] = ciudadDesc || "SIN CIUDAD";
      });

      toast({ title: "Cargando activos", description: "Obteniendo activos con ultimoregistro=1 (con excepción por ciudades)..." });

      let allActivos = [];
      let from = 0;
      const FETCH_CHUNK = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("act_activos")
          .select(ACTIVO_COLUMNS)
          .eq("ultimoregistro", 1)
          // PK única para paginación estable (codigoactivo no es único
          // y podía saltear/duplicar 1 fila entre páginas)
          .order("codigoactivointerno", { ascending: true })
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

      // Misma lógica del Inventario General
      allActivos = allActivos.filter((a) => {
        const ambCode = String(a.codigoAmbiente ?? "").trim();
        const ciudad = String(ciudadPorAmbiente[ambCode] ?? "").trim().toUpperCase();
        if (CIUDADES_EXCEPCION_SET.has(ciudad)) return true;
        const estadoInv = String(a.estadoinventario ?? a.estadoInventario ?? "").trim();
        return estadoInv !== "";
      });

      const normRubroExc = (s) => String(s || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const RUBROS_EXCLUIDOS = ["BIBLIOTEC", "EDIFICAC", "TERRENO"];
      allActivos = allActivos.filter((a) => {
        const rubroDesc = rubroFromTipo[a.tipoRubroAct] ?? rubroFromTipo[String(a.tipoRubroAct)] ?? "";
        return !RUBROS_EXCLUIDOS.some((k) => normRubroExc(rubroDesc).includes(k));
      });

      if (allActivos.length === 0) {
        toast({ title: "Sin datos", description: "No hay activos con los filtros del Inventario General.", variant: "destructive" });
        return;
      }
      console.debug("[PorRubro] total tras filtros estado+rubro:", allActivos.length);

      // Agrupar por rubro
      const conteoPorRubro = new Map();
      allActivos.forEach((a) => {
        const rubroDesc = String(rubroFromTipo[a.tipoRubroAct] ?? rubroFromTipo[String(a.tipoRubroAct)] ?? "SIN RUBRO").trim() || "SIN RUBRO";
        conteoPorRubro.set(rubroDesc, (conteoPorRubro.get(rubroDesc) ?? 0) + 1);
      });
      const rubrosOrdenados = [...conteoPorRubro.keys()].sort((x, y) => x.localeCompare(y, "es"));
      const body = rubrosOrdenados.map((rubro, idx) => [String(idx + 1), rubro, String(conteoPorRubro.get(rubro))]);

      toast({ title: "Generando PDF", description: `Construyendo reporte con ${rubrosOrdenados.length} rubros...` });

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      addLogo(doc);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("REPORTE POR RUBRO - ÓRGANO JUDICIAL", pageWidth / 2, 16, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Total activos: ${allActivos.length} en ${rubrosOrdenados.length} rubros`, pageWidth / 2, 21, { align: "center" });

      const tableWidth = 12 + 120 + 30;
      const marginLeft = (pageWidth - tableWidth) / 2;
      autoTable(doc, {
        startY: 26,
        head: [["N°", "Rubro", "Total Activos"]],
        body,
        foot: [["", "TOTAL GENERAL", String(allActivos.length)]],
        showFoot: "lastPage",
        theme: "striped",
        tableWidth,
        styles: { font: "helvetica", fontSize: 8, cellPadding: 1.8, overflow: "linebreak", valign: "middle" },
        headStyles: { fillColor: [16, 70, 140], textColor: [255, 255, 255], halign: "center", fontStyle: "bold", fontSize: 8 },
        footStyles: { fillColor: [230, 240, 255], textColor: [16, 70, 140], halign: "center", fontStyle: "bold", fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 12, halign: "center" },
          1: { cellWidth: 120, halign: "left" },
          2: { cellWidth: 30, halign: "center", fontStyle: "bold" },
        },
        margin: { left: marginLeft, right: marginLeft, top: 26 },
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

      doc.save(`Reporte_Por_Rubro.pdf`);
      toast({ title: "Reporte generado", description: `Se exportaron ${allActivos.length} activos en ${rubrosOrdenados.length} rubros.` });
    } catch (err) {
      console.error("Error generando Reporte por Rubro", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
