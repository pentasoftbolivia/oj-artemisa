import { useState, useCallback, useMemo } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { getCachedCatalog } from "@/lib/catalogCache";
import { createOptionsList } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { LOGO_JPG_DATA_URL } from "@/lib/logoJpgBase64";

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
  } catch {
    // sin logo: continúa sin imagen
  }
};

const clean = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

const sanitizeFile = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "TODOS";

const HEADERS = ["N°", "N° Acta", "Ciudad", "Inmueble", "Nivel", "Ambiente", "Carnet", "Responsable"];

/**
 * Lista de actas generadas (act_responsable_acta) por ciudad/inmueble.
 * Filtra por jerarquía ambiente -> nivel -> inmueble -> ciudad y enriquece
 * con el nombre del responsable. Genera Excel y PDF del listado.
 */
export const useListaActas = () => {
  const { toast } = useToast();
  const [catalogs, setCatalogs] = useState({ ciudades: [], inmuebles: [], niveles: [], ambientes: [] });
  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(false);
  const [actas, setActas] = useState([]);
  const [isLoadingActas, setIsLoadingActas] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const loadCatalogs = useCallback(async () => {
    setIsLoadingCatalogs(true);
    try {
      const [ciudades, inmuebles, niveles, ambientes] = await Promise.all([
        getCachedCatalog("act_ciudad"),
        getCachedCatalog("act_inmueble"),
        getCachedCatalog("act_nivel"),
        getCachedCatalog("act_ambiente"),
      ]);
      setCatalogs({ ciudades: ciudades || [], inmuebles: inmuebles || [], niveles: niveles || [], ambientes: ambientes || [] });
    } catch (err) {
      toast({ title: "Error", description: `No se pudieron cargar catálogos: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsLoadingCatalogs(false);
    }
  }, [toast]);

  const ciudadOptions = useMemo(() => {
    const opts = createOptionsList(catalogs.ciudades || [], "codigociudad", "descripcion");
    return opts.filter((o) => !String(o.label).toUpperCase().includes("(ELIMINAR)"));
  }, [catalogs.ciudades]);

  const inmuebleCiudadMap = useMemo(() => {
    const map = {};
    (catalogs.inmuebles || []).forEach((i) => {
      map[String(i.codigoinmueble ?? "").trim()] = String(i.codigociudad ?? "").trim();
    });
    return map;
  }, [catalogs.inmuebles]);

  const inmuebleOptionsByCiudad = useCallback((ciudad) => {
    const opts = createOptionsList(catalogs.inmuebles || [], "codigoinmueble", "inmueble");
    const cleanOpts = opts.filter((o) => !String(o.label).toUpperCase().includes("(ELIMINAR)"));
    const c = String(ciudad ?? "").trim();
    if (!c) return cleanOpts;
    return cleanOpts.filter((o) => String(inmuebleCiudadMap[String(o.value).trim()] ?? "").trim() === c);
  }, [catalogs.inmuebles, inmuebleCiudadMap]);

  const fetchActas = useCallback(async (ciudad, inmueble) => {
    const c = String(ciudad ?? "").trim();
    const inm = String(inmueble ?? "").trim();
    if (!c && !inm) {
      setActas([]);
      return [];
    }
    setIsLoadingActas(true);
    try {
      const [responsables, ambientes, niveles, inmuebles, ciudades] = await Promise.all([
        getCachedCatalog("act_responsable"),
        getCachedCatalog("act_ambiente"),
        getCachedCatalog("act_nivel"),
        getCachedCatalog("act_inmueble"),
        getCachedCatalog("act_ciudad"),
      ]);

      const nivelMap = {};
      (niveles || []).forEach((n) => { nivelMap[String(n.codigonivel ?? "").trim()] = n; });
      const inmuebleMap = {};
      (inmuebles || []).forEach((i) => { inmuebleMap[String(i.codigoinmueble ?? "").trim()] = i; });
      const ciudadMap = {};
      (ciudades || []).forEach((cd) => { ciudadMap[String(cd.codigociudad ?? "").trim()] = cd.descripcion; });
      const ambienteMap = {};
      (ambientes || []).forEach((a) => {
        const code = String(a.codigoambiente ?? "").trim();
        if (!code) return;
        const nivel = nivelMap[String(a.codigonivel ?? "").trim()];
        const inmuebleRow = nivel ? inmuebleMap[String(nivel.codigoinmueble ?? "").trim()] : null;
        const codInmueble = String(inmuebleRow?.codigoinmueble ?? "").trim();
        ambienteMap[code] = {
          ambiente: String(a.ambiente ?? "").trim(),
          nivel: String(nivel?.nivel ?? "").trim(),
          codInmueble,
          inmueble: String(inmuebleRow?.inmueble ?? "").trim(),
          codCiudad: String(inmuebleRow?.codigociudad ?? "").trim(),
          ciudad: String(ciudadMap[String(inmuebleRow?.codigociudad ?? "").trim()] ?? "").trim(),
        };
      });

      const respMap = {};
      (responsables || []).forEach((r) => {
        respMap[String(r.cirun ?? "").trim()] = r;
      });

      let rows = [];
      {
        let from = 0;
        const CHUNK = 1000;
        while (true) {
          const { data, error } = await supabase
            .from("act_responsable_acta")
            .select("cirun, numeroacta, codigoambiente")
            .not("numeroacta", "is", null)
            .range(from, from + CHUNK - 1);
          if (error) throw error;
          const batch = data || [];
          if (batch.length === 0) break;
          rows = rows.concat(batch);
          if (batch.length < CHUNK) break;
          from += CHUNK;
          if (rows.length > 100000) break;
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      const list = rows
        .filter((r) => String(r.cirun || "").trim() !== "" && r.numeroacta != null && String(r.numeroacta).trim() !== "")
        .map((r) => {
          const ambCode = String(r.codigoambiente || "").trim();
          const ub = ambienteMap[ambCode] || { ambiente: ambCode, nivel: "", codInmueble: "", inmueble: "", codCiudad: "", ciudad: "" };
          const resp = respMap[String(r.cirun).trim()];
          const nombre = resp
            ? [resp.nombre1, resp.nombre2, resp.paterno, resp.materno].map((s) => (s || "").trim()).filter(Boolean).join(" ") || String(r.cirun).trim()
            : String(r.cirun).trim();
          return {
            numeroacta: Number(r.numeroacta),
            cirun: String(r.cirun).trim(),
            responsable: nombre,
            ciudad: ub.ciudad || "—",
            codCiudad: ub.codCiudad,
            inmueble: ub.inmueble || "—",
            codInmueble: ub.codInmueble,
            nivel: ub.nivel || "—",
            ambiente: ub.ambiente || ambCode || "—",
          };
        })
        .filter((a) => {
          if (inm && a.codInmueble !== inm) return false;
          if (!inm && c && a.codCiudad !== c) return false;
          return true;
        })
        .sort((a, b) => a.numeroacta - b.numeroacta);

      setActas(list);
      return list;
    } catch (err) {
      toast({ title: "Error", description: `No se pudo obtener el listado de actas: ${formatError(err)}`, variant: "destructive" });
      setActas([]);
      return [];
    } finally {
      setIsLoadingActas(false);
    }
  }, [toast]);

  const etiquetaOf = useCallback((ciudad, inmueble) => {
    if (inmueble) {
      const row = (catalogs.inmuebles || []).find((i) => String(i.codigoinmueble ?? "").trim() === String(inmueble).trim());
      return clean(row?.inmueble) || String(inmueble).trim();
    }
    if (ciudad) {
      const row = (catalogs.ciudades || []).find((cd) => String(cd.codigociudad ?? "").trim() === String(ciudad).trim());
      return clean(row?.descripcion) || String(ciudad).trim();
    }
    return "TODOS";
  }, [catalogs.inmuebles, catalogs.ciudades]);

  const generateExcel = useCallback(async (rows, etiqueta) => {
    if (!rows || rows.length === 0) {
      toast({ title: "Sin datos", description: "No hay actas para exportar con el filtro actual.", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const body = rows.map((a, idx) => [
        idx + 1,
        a.numeroacta,
        clean(a.ciudad) || "—",
        clean(a.inmueble) || "—",
        clean(a.nivel) || "—",
        clean(a.ambiente) || "—",
        a.cirun,
        clean(a.responsable) || "—",
      ]);
      const sheetData = [
        ["LISTA DE ACTAS - ÓRGANO JUDICIAL"],
        [`Ubicación: ${etiqueta} | Total actas: ${rows.length}`],
        [`Fecha: ${dateStr}`],
        [],
        HEADERS,
        ...body,
        [],
        [],
        [],
        ["", "", "ENTREGUE CONFORME", "", "", "", "RECIBI CONFORME", ""],
      ];
      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws["!cols"] = [{ wch: 6 }, { wch: 12 }, { wch: 24 }, { wch: 36 }, { wch: 26 }, { wch: 36 }, { wch: 16 }, { wch: 40 }];
      ws["!pageSetup"] = { orientation: "landscape", paperSize: 1, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Actas");
      XLSX.writeFile(wb, `Lista_Actas_${sanitizeFile(etiqueta)}_${dateStr}.xlsx`);
      toast({ title: "Reporte generado", description: `Se exportaron ${rows.length} actas.` });
    } catch (err) {
      toast({ title: "Error", description: `No se pudo generar el Excel: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  const generatePDF = useCallback(async (rows, etiqueta) => {
    if (!rows || rows.length === 0) {
      toast({ title: "Sin datos", description: "No hay actas para exportar con el filtro actual.", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    try {
      const body = rows.map((a, idx) => [
        String(idx + 1),
        String(a.numeroacta),
        clean(a.ciudad) || "—",
        clean(a.inmueble) || "—",
        clean(a.nivel) || "—",
        clean(a.ambiente) || "—",
        a.cirun,
        clean(a.responsable) || "—",
      ]);
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      addLogo(doc);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("LISTA DE ACTAS - ÓRGANO JUDICIAL", pageWidth / 2, 16, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Ubicación: ${etiqueta}  |  Total actas: ${rows.length}`, pageWidth / 2, 21, { align: "center" });
      autoTable(doc, {
        startY: 26,
        head: [HEADERS],
        body,
        theme: "striped",
        styles: { font: "helvetica", fontSize: 8, cellPadding: 1.6, overflow: "linebreak", valign: "middle" },
        headStyles: { fillColor: [31, 78, 121], textColor: [255, 255, 255], halign: "center", fontStyle: "bold", fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 12, halign: "center" },
          1: { cellWidth: 22, halign: "center" },
          2: { cellWidth: 28, halign: "left" },
          3: { cellWidth: 42, halign: "left" },
          4: { cellWidth: 34, halign: "left" },
          5: { cellWidth: 42, halign: "left" },
          6: { cellWidth: 24, halign: "center" },
          7: { cellWidth: 55, halign: "left" },
        },
        margin: { top: 26, left: 8, right: 8 },
      });
      // Bloques de firma al final: ENTREGUE CONFORME (izq.) y RECIBI CONFORME (der.)
      let sigY = doc.lastAutoTable.finalY + 24;
      if (sigY + 12 > pageHeight - 10) {
        doc.addPage();
        addLogo(doc);
        sigY = 32;
      }
      doc.setDrawColor(100);
      doc.line(45, sigY, 125, sigY);
      doc.line(155, sigY, 235, sigY);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("ENTREGUE CONFORME", 85, sigY + 6, { align: "center" });
      doc.text("RECIBI CONFORME", 195, sigY + 6, { align: "center" });
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        if (i > 1) addLogo(doc);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80);
        doc.text(`Página ${i} de ${totalPages}  |  LISTA DE ACTAS - Órgano Judicial`, pageWidth / 2, pageHeight - 7, { align: "center" });
      }
      const dateStr = new Date().toISOString().slice(0, 10);
      doc.save(`Lista_Actas_${sanitizeFile(etiqueta)}_${dateStr}.pdf`);
      toast({ title: "Reporte generado", description: `Se exportaron ${rows.length} actas.` });
    } catch (err) {
      toast({ title: "Error", description: `No se pudo generar el PDF: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return {
    ciudadOptions,
    inmuebleOptionsByCiudad,
    isLoadingCatalogs,
    actas,
    isLoadingActas,
    isGenerating,
    loadCatalogs,
    fetchActas,
    etiquetaOf,
    generateExcel,
    generatePDF,
  };
};
