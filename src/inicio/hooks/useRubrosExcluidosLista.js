import { useState, useCallback } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { getCachedCatalog } from "@/lib/catalogCache";
import { toCamelCaseArray } from "@/lib/mapFields";
import { useToast } from "@/hooks/use-toast";
import { LOGO_JPG_DATA_URL } from "@/lib/logoJpgBase64";
import { ACTIVO_COLUMNS } from "@/lib/activoColumns";

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

const normTxt = (s) =>
  String(s || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Solo estos rubros: edificaciones, biblioteca y terrenos
const RUBROS_INCLUIDOS = ["BIBLIOTEC", "EDIFICAC", "TERRENO"];

const getEstadoAltaBajaLabel = (v) => {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "1" || s === "TRUE" || s === "ALTA") return "Alta";
  if (s === "0" || s === "FALSE" || s === "BAJA") return "Baja";
  return s || "—";
};

const HEADERS = [
  "N°", "Código Activo", "Tipo Rubro", "Descripción", "Conservación",
  "Responsable", "Carnet", "Estado", "Ciudad", "Inmueble", "Nivel", "Ambiente",
];
const NCOLS = HEADERS.length;

/**
 * EDIFICACIONES, BIBLIOTECA Y TERRENOS — PRODUCTO 4.
 * Criterio: ultimoregistro=1 y rubro en (edificaciones, biblioteca, terrenos).
 * Listado detallado agrupado por rubro, en pantalla, PDF y Excel.
 */
export const useRubrosExcluidosLista = () => {
  const { toast } = useToast();
  const [grupos, setGrupos] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchGrupos = useCallback(async () => {
    setIsLoading(true);
    try {
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
      const ubicacionPartsMap = {};
      (ambientes || []).forEach((a) => {
        const code = String(a.codigoambiente ?? "").trim();
        if (!code) return;
        const nivel = nivelMap[String(a.codigonivel ?? "").trim()];
        const inmueble = nivel ? inmuebleMap[String(nivel.codigoinmueble ?? "").trim()] : null;
        const ciudad = inmueble ? ciudadMap[String(inmueble.codigociudad ?? "").trim()] : null;
        ubicacionPartsMap[code] = {
          ciudad: String(ciudad?.descripcion ?? "").trim(),
          inmueble: String(inmueble?.inmueble ?? "").trim(),
          nivel: String(nivel?.nivel ?? "").trim(),
          ambiente: String(a.ambiente ?? "").trim(),
        };
      });

      const respMap = {};
      (responsables || []).forEach((r) => {
        respMap[String(r.cirun ?? "").trim()] = r;
      });
      const responsableNameOf = (cirun) => {
        const rawCi = String(cirun ?? "").trim();
        if (!rawCi) return "—";
        const resp = respMap[rawCi];
        if (!resp) return rawCi;
        return (
          [resp.nombre1, resp.nombre2, resp.paterno, resp.materno]
            .map((s) => (s || "").trim())
            .filter(Boolean)
            .join(" ") || resp.cirun
        );
      };

      let rows = [];
      {
        let from = 0;
        const CHUNK = 1000;
        while (true) {
          const { data, error } = await supabase
            .from("act_activos")
            .select(ACTIVO_COLUMNS)
            .eq("ultimoregistro", 1)
            .eq("estado", 1)
            .range(from, from + CHUNK - 1);
          if (error) throw error;
          const batch = toCamelCaseArray(data || []);
          if (batch.length === 0) break;
          rows = rows.concat(batch);
          if (batch.length < CHUNK) break;
          from += CHUNK;
          if (rows.length > 100000) break;
          await new Promise((r) => setTimeout(r, 0));
        }
      }
      // Refuerzo en cliente: ultimoregistro=1, estado=1 y solo los 3 rubros
      const filtrados = rows.filter((a) => {
        if (String(a.ultimoRegistro ?? a.ultimoregistro ?? "").trim() !== "1") return false;
        const est = a.estado ?? a.estadoActivo;
        const esAlta =
          est === 1 || est === true
            ? true
            : ["1", "TRUE", "T", "ALTA"].includes(String(est ?? "").trim().toUpperCase());
        if (!esAlta) return false;
        const tipoRubroAct = a.tipoRubroAct ?? a.tiporubroact;
        const rubroDesc = rubroFromTipo[tipoRubroAct] ?? rubroFromTipo[String(tipoRubroAct)] ?? "";
        if (!RUBROS_INCLUIDOS.some((k) => normTxt(rubroDesc).includes(k))) return false;
        return true;
      });

      const porRubro = {};
      filtrados.forEach((a) => {
        const tipoRubroAct = a.tipoRubroAct ?? a.tiporubroact;
        const rubroDesc = rubroFromTipo[tipoRubroAct] ?? rubroFromTipo[String(tipoRubroAct)] ?? "SIN RUBRO";
        const ambCode = String(a.codigoAmbiente ?? a.codigoambiente ?? "").trim();
        const ciRaw = String(a.cirun ?? "").trim();
        const parts = ubicacionPartsMap[ambCode] || { ciudad: "", inmueble: "", nivel: "", ambiente: "" };
        const codigoActivo = a.codigoActivo ?? a.codigoactivo;
        const item = {
          codigoActivo,
          codigo: codigoActivo != null ? `OJ-02-${codigoActivo}` : "—",
          tipo: tipoRubroDescMap[tipoRubroAct] ?? tipoRubroDescMap[String(tipoRubroAct)] ?? "—",
          descripcion: a.descripcionActivo ?? a.descripcionactivo ?? "—",
          conservacion: String(a.estadoConservacion ?? a.estadoconservacion ?? "").trim().toUpperCase() || "—",
          responsable: responsableNameOf(ciRaw),
          cirun: ciRaw || "—",
          estado: getEstadoAltaBajaLabel(a.estado ?? a.estadoActivo),
          ciudad: parts.ciudad,
          inmueble: parts.inmueble,
          nivel: parts.nivel,
          ambiente: parts.ambiente,
        };
        if (!porRubro[rubroDesc]) porRubro[rubroDesc] = [];
        porRubro[rubroDesc].push(item);
      });

      const lista = Object.entries(porRubro)
        .map(([rubro, items]) => ({
          rubro,
          items: items.sort((x, y) => Number(x.codigoActivo ?? 0) - Number(y.codigoActivo ?? 0)),
        }))
        .sort((a, b) => a.rubro.localeCompare(b.rubro, "es"));

      setGrupos(lista);
      setTotal(filtrados.length);
      return lista;
    } catch (err) {
      toast({ title: "Error", description: `No se pudo obtener el listado: ${formatError(err)}`, variant: "destructive" });
      setGrupos([]);
      setTotal(0);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const rowOf = (a, idx) => [
    String(idx + 1),
    a.codigo,
    clean(a.tipo) || "—",
    clean(a.descripcion) || "—",
    a.conservacion || "—",
    clean(a.responsable) || "—",
    a.cirun || "—",
    a.estado || "—",
    clean(a.ciudad),
    clean(a.inmueble),
    clean(a.nivel),
    clean(a.ambiente),
  ];

  const generateExcel = useCallback(async (lista) => {
    const data = lista && lista.length ? lista : grupos;
    const tot = data.reduce((s, g) => s + g.items.length, 0);
    if (tot === 0) {
      toast({ title: "Sin datos", description: "No hay activos con ese criterio.", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const sheetData = [
        ["EDIFICACIONES, BIBLIOTECA Y TERRENOS - ÓRGANO JUDICIAL"],
        [`Total activos: ${tot} en ${data.length} rubros`],
        [`Fecha: ${dateStr}`],
        [],
      ];
      const merges = [];
      let n = 1;
      data.forEach((g) => {
        const r = sheetData.length;
        sheetData.push([`RUBRO: ${g.rubro} (${g.items.length} activos)`]);
        merges.push({ s: { r, c: 0 }, e: { r, c: NCOLS - 1 } });
        sheetData.push(HEADERS);
        g.items.forEach((a) => {
          sheetData.push(rowOf(a, n));
          n += 1;
        });
        sheetData.push([]);
      });
      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws["!merges"] = merges;
      ws["!cols"] = [{ wch: 6 }, { wch: 16 }, { wch: 30 }, { wch: 60 }, { wch: 14 }, { wch: 32 }, { wch: 16 }, { wch: 10 }, { wch: 24 }, { wch: 32 }, { wch: 24 }, { wch: 32 }];
      ws["!pageSetup"] = { orientation: "landscape", paperSize: 1, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "EdifBibTerr");
      XLSX.writeFile(wb, `Edificaciones_Biblioteca_Terrenos_${dateStr}.xlsx`);
      toast({ title: "Reporte generado", description: `Se exportaron ${tot} activos en ${data.length} rubros.` });
    } catch (err) {
      toast({ title: "Error", description: `No se pudo generar el Excel: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [grupos, toast]);

  const generatePDF = useCallback(async (lista) => {
    const data = lista && lista.length ? lista : grupos;
    const tot = data.reduce((s, g) => s + g.items.length, 0);
    if (tot === 0) {
      toast({ title: "Sin datos", description: "No hay activos con ese criterio.", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    try {
      const groupStyle = { fillColor: [31, 78, 121], textColor: [255, 255, 255], fontStyle: "bold", halign: "left", fontSize: 8 };
      const body = [];
      let n = 1;
      data.forEach((g) => {
        body.push([{ content: `RUBRO: ${g.rubro} (${g.items.length} activos)`, colSpan: NCOLS, styles: groupStyle }]);
        g.items.forEach((a) => {
          body.push(rowOf(a, n));
          n += 1;
        });
      });
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "legal" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      addLogo(doc);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("EDIFICACIONES, BIBLIOTECA Y TERRENOS - ÓRGANO JUDICIAL", pageWidth / 2, 16, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Total activos: ${tot} en ${data.length} rubros`, pageWidth / 2, 21, { align: "center" });
      autoTable(doc, {
        startY: 26,
        head: [HEADERS],
        body,
        theme: "striped",
        styles: { font: "helvetica", fontSize: 7, cellPadding: 1.4, overflow: "linebreak", valign: "middle" },
        headStyles: { fillColor: [31, 78, 121], textColor: [255, 255, 255], halign: "center", fontStyle: "bold", fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 20, halign: "center" },
          2: { cellWidth: 34, halign: "left" },
          3: { cellWidth: 62, halign: "left" },
          4: { cellWidth: 18, halign: "center" },
          5: { cellWidth: 40, halign: "left" },
          6: { cellWidth: 18, halign: "center" },
          7: { cellWidth: 14, halign: "center" },
          8: { cellWidth: 28, halign: "left" },
          9: { cellWidth: 34, halign: "left" },
          10: { cellWidth: 28, halign: "left" },
          11: { cellWidth: 34, halign: "left" },
        },
        margin: { top: 26, left: 6, right: 6 },
      });
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        if (i > 1) addLogo(doc);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80);
        doc.text(`Página ${i} de ${totalPages}  |  EDIFICACIONES, BIBLIOTECA Y TERRENOS - Órgano Judicial`, pageWidth / 2, pageHeight - 7, { align: "center" });
      }
      const dateStr = new Date().toISOString().slice(0, 10);
      doc.save(`Edificaciones_Biblioteca_Terrenos_${dateStr}.pdf`);
      toast({ title: "Reporte generado", description: `Se exportaron ${tot} activos en ${data.length} rubros.` });
    } catch (err) {
      toast({ title: "Error", description: `No se pudo generar el PDF: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [grupos, toast]);

  // Descarga directa: obtiene el listado y genera el archivo (sin mostrarlo antes).
  // generatingFormat indica qué botón se está ejecutando ("excel"/"pdf"/null)
  // para que cada botón muestre su propio spinner sin afectar al otro.
  const [generatingFormat, setGeneratingFormat] = useState(null);

  const downloadExcel = useCallback(async () => {
    setGeneratingFormat("excel");
    try {
      const lista = await fetchGrupos();
      await generateExcel(lista);
    } finally {
      setGeneratingFormat(null);
    }
  }, [fetchGrupos, generateExcel]);

  const downloadPDF = useCallback(async () => {
    setGeneratingFormat("pdf");
    try {
      const lista = await fetchGrupos();
      await generatePDF(lista);
    } finally {
      setGeneratingFormat(null);
    }
  }, [fetchGrupos, generatePDF]);

  return { grupos, total, isLoading, isGenerating, generatingFormat, fetchGrupos, generateExcel, generatePDF, downloadExcel, downloadPDF };
};
