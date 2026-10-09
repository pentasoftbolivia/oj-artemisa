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

const LOGO_W = 32;
const LOGO_H = LOGO_W * (57 / 256);
const addLogo = (doc) => {
  try {
    doc.addImage(LOGO_JPG_DATA_URL, "JPEG", 14, 8, LOGO_W, LOGO_H);
  } catch {}
};

const normTxt = (s) =>
  String(s || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Excepción: no tomar en cuenta BIBLIOTECA(S), TERRENOS, EDIFICACIONES
const RUBROS_EXCLUIDOS = ["BIBLIOTEC", "TERRENO", "EDIFICAC"];

const ESTADOS_VALIDOS = ["REVISADO", "INVENTARIADO"];

const parseNum = (v) => {
  if (v == null || String(v).trim() === "") return 0;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const fmtBs = (n) =>
  Number(n || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Reporte Grupo Contable (PDF) — PRODUCTO 3.
 * Hoja 1: N°, GRUPO CONTABLE, CANTIDAD ACTIVOS (ultimoregistro=1, REVISADO/INVENTARIADO; excluye 3 rubros)
 * Hoja 2: grupo contable de ciudades excluidas (N°, GRUPO CONTABLE, CANTIDAD ACTIVOS)
 * Hoja 3: ACTIVOS REVALUADOS POR GRUPO CONTABLE (pararevaluo=true + REVISADO/INVENTARIADO/EN PROCESO)
 */
export const useReporteGrupoContable = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    try {
      toast({ title: "Generando Grupo Contable", description: "Cargando catálogos..." });

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

      // Ciudad por ambiente (misma lógica que Reporte por Rubro / Inventario General)
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

      toast({ title: "Cargando activos", description: "Obteniendo activos vigentes REVISADO/INVENTARIADO..." });

      let allActivos = [];
      let from = 0;
      const FETCH_CHUNK = 1000;
      while (true) {
        // Sin filtro estadoinventario en servidor (case/espacios los maneja el cliente)
        const { data, error } = await supabase
          .from("act_activos")
          .select(ACTIVO_COLUMNS)
          .eq("ultimoregistro", 1)
          .order("codigoactivointerno", { ascending: true })
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
      const totalVigentes = allActivos.length;
      const vigentes = [...allActivos];

      // Solo REVISADO / INVENTARIADO (insensible a mayúsculas y espacios)
      allActivos = allActivos.filter((a) => {
        const est = String(a.estadoinventario ?? a.estadoInventario ?? "").trim().toUpperCase();
        return ESTADOS_VALIDOS.includes(est);
      });
      const totalConEstado = allActivos.length;
      allActivos = allActivos.filter((a) => {
        const rubroDesc = rubroFromTipo[a.tipoRubroAct] ?? rubroFromTipo[String(a.tipoRubroAct)] ?? "";
        const n = normTxt(rubroDesc);
        return !RUBROS_EXCLUIDOS.some((k) => n.includes(k));
      });
      console.debug("[GrupoContable] vigentes:", totalVigentes, "| con REVISADO/INVENTARIADO:", totalConEstado, "| tras excluir 3 rubros:", allActivos.length);

      if (allActivos.length === 0) {
        toast({ title: "Sin datos", description: "No hay activos REVISADO/INVENTARIADO para el reporte.", variant: "destructive" });
        return;
      }

      // Agrupar por rubro (solo cantidad)
      const grupos = new Map();
      allActivos.forEach((a) => {
        const rubroDesc = String(rubroFromTipo[a.tipoRubroAct] ?? rubroFromTipo[String(a.tipoRubroAct)] ?? "SIN RUBRO").trim() || "SIN RUBRO";
        grupos.set(rubroDesc, (grupos.get(rubroDesc) ?? 0) + 1);
      });
      const ordenados = [...grupos.keys()].sort((x, y) => x.localeCompare(y, "es"));

      const body = ordenados.map((rubro, idx) => [String(idx + 1), rubro, String(grupos.get(rubro))]);

      const totalCantidad = ordenados.reduce((s, k) => s + grupos.get(k), 0);

      toast({ title: "Generando PDF", description: `Construyendo reporte con ${ordenados.length} grupos...` });

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      addLogo(doc);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("REPORTE GRUPO CONTABLE - ÓRGANO JUDICIAL", pageWidth / 2, 16, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(
        `Total activos: ${totalCantidad} en ${ordenados.length} grupos`,
        pageWidth / 2,
        21,
        { align: "center" }
      );

      const tableWidth = 12 + 120 + 30;
      const marginLeft = (pageWidth - tableWidth) / 2;
      autoTable(doc, {
        startY: 26,
        head: [["N°", "GRUPO CONTABLE", "CANTIDAD ACTIVOS"]],
        body,
        foot: [["", "TOTAL GENERAL", String(totalCantidad)]],
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

      // ---- Hoja 2: grupo contable de ciudades excluidas ----
      // Base: vigentes (ultimoregistro=1) cuya ciudad está en CIUDADES_EXCEPCION_SET,
      // sin exigir estadoinventario (misma lógica de excepción del Inventario General).
      const excActivos = vigentes.filter((a) => {
        const ambCode = String(a.codigoAmbiente ?? a.codigoambiente ?? "").trim();
        const ciudad = String(ciudadPorAmbiente[ambCode] ?? "").trim().toUpperCase();
        if (!CIUDADES_EXCEPCION_SET.has(ciudad)) return false;
        const rubroDesc = rubroFromTipo[a.tipoRubroAct] ?? rubroFromTipo[String(a.tipoRubroAct)] ?? "";
        return !RUBROS_EXCLUIDOS.some((k) => normTxt(rubroDesc).includes(k));
      });
      console.debug("[GrupoContable] ciudades excluidas:", excActivos.length);
      const excGrupos = new Map();
      excActivos.forEach((a) => {
        const rubroDesc = String(rubroFromTipo[a.tipoRubroAct] ?? rubroFromTipo[String(a.tipoRubroAct)] ?? "SIN RUBRO").trim() || "SIN RUBRO";
        excGrupos.set(rubroDesc, (excGrupos.get(rubroDesc) ?? 0) + 1);
      });
      const excOrdenados = [...excGrupos.keys()].sort((x, y) => x.localeCompare(y, "es"));
      const excBody = excOrdenados.map((rubro, idx) => [String(idx + 1), rubro, String(excGrupos.get(rubro))]);
      const excTotal = excOrdenados.reduce((s, k) => s + excGrupos.get(k), 0);

      doc.addPage();
      addLogo(doc);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("GRUPO CONTABLE CIUDADES EXCLUIDAS", pageWidth / 2, 16, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Total activos: ${excTotal} en ${excOrdenados.length} grupos`, pageWidth / 2, 21, { align: "center" });
      autoTable(doc, {
        startY: 26,
        head: [["N°", "GRUPO CONTABLE", "CANTIDAD ACTIVOS"]],
        body: excBody.length > 0 ? excBody : [["", "Sin activos en ciudades excluidas", ""]],
        foot: [["", "TOTAL GENERAL", String(excTotal)]],
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

      // ---- Hoja 3: activos revaluados por grupo contable ----
      // Base exacta: ultimoregistro=1 + pararevaluo=true + estadoinventario en (INVENTARIADO, REVISADO, EN PROCESO).
      toast({ title: "Cargando revalúo", description: "Obteniendo activos con pararevaluo=true..." });
      const SELECT_REV = `${ACTIVO_COLUMNS},valorneto,valorrevaluo`;
      const REV_ESTADOS = ["REVISADO", "INVENTARIADO", "EN PROCESO"];
      let revActivos = [];
      {
        let rFrom = 0;
        while (true) {
          const { data, error } = await supabase
            .from("act_activos")
            .select(SELECT_REV)
            .eq("ultimoregistro", 1)
            .eq("pararevaluo", true)
            .order("codigoactivointerno", { ascending: true })
            .range(rFrom, rFrom + FETCH_CHUNK - 1);
          if (error) throw error;
          const batch = toCamelCaseArray(data || []);
          if (batch.length === 0) break;
          revActivos = revActivos.concat(batch);
          if (batch.length < FETCH_CHUNK) break;
          rFrom += FETCH_CHUNK;
          if (revActivos.length > 100000) break;
          await new Promise((r) => setTimeout(r, 0));
        }
      }
      const totalRevBase = revActivos.length;
      // INVENTARIADO / REVISADO / EN PROCESO (insensible a mayúsculas y espacios), sin excluir rubros
      revActivos = revActivos.filter((a) => {
        const est = String(a.estadoinventario ?? a.estadoInventario ?? "").trim().toUpperCase();
        return REV_ESTADOS.includes(est);
      });
      console.debug("[GrupoContable] revaluados base (ultim=1, pararevaluo=true):", totalRevBase, "| con INVENTARIADO/REVISADO/EN PROCESO:", revActivos.length);

      const revGrupos = new Map();
      revActivos.forEach((a) => {
        const rubroDesc = String(rubroFromTipo[a.tipoRubroAct] ?? rubroFromTipo[String(a.tipoRubroAct)] ?? "SIN RUBRO").trim() || "SIN RUBRO";
        const cur = revGrupos.get(rubroDesc) || { cantidad: 0, valorNeto: 0, valorRevaluado: 0 };
        cur.cantidad += 1;
        cur.valorNeto += parseNum(a.valorNeto ?? a.valorneto);
        cur.valorRevaluado += parseNum(a.valorRevaluo ?? a.valorrevaluo);
        revGrupos.set(rubroDesc, cur);
      });
      const revOrdenados = [...revGrupos.keys()].sort((x, y) => x.localeCompare(y, "es"));
      const revBody = revOrdenados.map((rubro, idx) => {
        const g = revGrupos.get(rubro);
        return [String(idx + 1), rubro, String(g.cantidad), fmtBs(g.valorNeto), fmtBs(g.valorRevaluado)];
      });
      const revTotalCant = revOrdenados.reduce((s, k) => s + revGrupos.get(k).cantidad, 0);
      const revTotalNeto = revOrdenados.reduce((s, k) => s + revGrupos.get(k).valorNeto, 0);
      const revTotalRev = revOrdenados.reduce((s, k) => s + revGrupos.get(k).valorRevaluado, 0);

      doc.addPage();
      addLogo(doc);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("ACTIVOS REVALUADOS POR GRUPO CONTABLE", pageWidth / 2, 16, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Total activos revaluados: ${revTotalCant} en ${revOrdenados.length} grupos`, pageWidth / 2, 21, { align: "center" });
      autoTable(doc, {
        startY: 26,
        head: [["N°", "GRUPO CONTABLE", "CANTIDAD DE ACTIVOS", "VALOR NETO REGISTRADO (Bs.)", "VALOR REVALUADO (Bs.)"]],
        body: revBody.length > 0 ? revBody : [["", "Sin activos revaluados", "", "", ""]],
        foot: [["", "TOTAL GENERAL", String(revTotalCant), fmtBs(revTotalNeto), fmtBs(revTotalRev)]],
        showFoot: "lastPage",
        theme: "striped",
        styles: { font: "helvetica", fontSize: 8, cellPadding: 1.8, overflow: "linebreak", valign: "middle" },
        headStyles: { fillColor: [16, 70, 140], textColor: [255, 255, 255], halign: "center", fontStyle: "bold", fontSize: 8 },
        footStyles: { fillColor: [230, 240, 255], textColor: [16, 70, 140], halign: "center", fontStyle: "bold", fontSize: 8 },
        columnStyles: {
          0: { halign: "center", cellWidth: 14 },
          1: { halign: "left" },
          2: { halign: "center", cellWidth: 32 },
          3: { halign: "right", cellWidth: 52 },
          4: { halign: "right", cellWidth: 52 },
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

      doc.save("Reporte_Grupo_Contable.pdf");
      toast({ title: "Reporte generado", description: `Hoja 1: ${totalCantidad} en ${ordenados.length} grupos. Hoja 2 excluidas: ${excTotal} en ${excOrdenados.length} grupos. Hoja 3 revaluados: ${revTotalCant} en ${revOrdenados.length} grupos.` });
    } catch (err) {
      console.error("Error generando Reporte Grupo Contable", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
