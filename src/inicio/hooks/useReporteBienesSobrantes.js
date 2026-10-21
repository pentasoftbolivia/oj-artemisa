import { useState, useCallback } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/lib/supabase";
import { getCachedCatalog } from "@/lib/catalogCache";
import { toCamelCaseArray } from "@/lib/mapFields";
import { useToast } from "@/hooks/use-toast";
import { LOGO_JPG_DATA_URL } from "@/lib/logoJpgBase64";
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

const fmtMoneyBE = (v) =>
  v === null || v === undefined
    ? "—"
    : Number(v).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const parseNumBE = (v) => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(String(v).replace(",", "."));
  return isNaN(n) ? null : n;
};
const addLogo = (doc) => {
  try {
    doc.addImage(LOGO_JPG_DATA_URL, "JPEG", 14, 8, LOGO_W, LOGO_H);
  } catch {
    return;
  }
};

const isTrueish = (v) => {
  if (v === true || v === 1) return true;
  const s = String(v ?? "").trim().toUpperCase();
  return s === "TRUE" || s === "1" || s === "T" || s === "SI" || s === "SÍ";
};

/**
 * Reporte BIENES SOBRANTES (PDF) — PRODUCTO 3.
 * Criterio: ultimoregistro=1 AND activonuevo=TRUE.
 * Si la columna activonuevo no existe en BD, se avisa (sin respaldo:
 * solo ultimoregistro=1 traería todo el universo).
 * Columnas tras Carnet: Valor Revaluado (valorrevaluo). No hay más columnas.
 * Orden: codigoactivo ASC.
 */
export const useReporteBienesSobrantes = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async (options = {}) => {
    const porRubro = options?.porRubro === true;
    setIsGenerating(true);
    try {
      toast({ title: "Generando Bienes Sobrantes", description: "Cargando catálogos..." });

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

      toast({ title: "Cargando activos", description: "Obteniendo bienes sobrantes (activonuevo=TRUE)..." });

      let allActivos = [];
      {
        let from = 0;
        const FETCH_CHUNK = 1000;
        while (true) {
          // Igual al script verificado: select * where activonuevo=true and ultimoregistro=1
          // (orden en cliente para no alterar el filtro del servidor)
          const { data, error } = await supabase
            .from("act_activos")
            .select("*")
            .eq("activonuevo", true)
            .eq("ultimoregistro", 1)
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
      // Refuerzo en cliente
      allActivos = allActivos.filter((a) => isTrueish(a.activonuevo ?? a.activoNuevo));
      allActivos.sort((a, b) => Number(a.codigoActivo ?? a.codigoactivo ?? 0) - Number(b.codigoActivo ?? b.codigoactivo ?? 0));
      const totalRevaluo = allActivos.reduce(
        (s, a) => s + (parseNumBE(a.valorRevaluo ?? a.valorrevaluo) ?? 0),
        0
      );

      if (porRubro) {
        const conteoPorRubro = new Map();
        const valorPorRubro = new Map();
        allActivos.forEach((a) => {
          const tipo = a.tipoRubroAct ?? a.tiporubroact;
          const rubroDesc = String(rubroFromTipo[tipo] ?? rubroFromTipo[String(tipo)] ?? "SIN RUBRO").trim() || "SIN RUBRO";
          conteoPorRubro.set(rubroDesc, (conteoPorRubro.get(rubroDesc) ?? 0) + 1);
          const revaluo = parseNumBE(a.valorRevaluo ?? a.valorrevaluo) ?? 0;
          valorPorRubro.set(rubroDesc, (valorPorRubro.get(rubroDesc) ?? 0) + revaluo);
        });
        const rubrosOrdenados = [...conteoPorRubro.keys()].sort((x, y) => x.localeCompare(y, "es"));
        const body = rubrosOrdenados.map((rubro, idx) => [
          String(idx + 1),
          rubro,
          String(conteoPorRubro.get(rubro)),
          fmtMoneyBE(valorPorRubro.get(rubro) ?? 0),
        ]);
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        addLogo(doc);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.text("BIENES SOBRANTES POR RUBRO - ÓRGANO JUDICIAL", pageWidth / 2, 20, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(`Total activos: ${allActivos.length} en ${rubrosOrdenados.length} rubros`, pageWidth / 2, 25, { align: "center" });
        autoTable(doc, {
          startY: 30,
          head: [["N°", "Rubro", "Total Activos", "Valor Revaluado"]],
          body,
          foot: [["", "TOTAL GENERAL", String(allActivos.length), fmtMoneyBE(totalRevaluo)]],
          showFoot: "lastPage",
          theme: "striped",
          styles: { font: "helvetica", fontSize: 8, cellPadding: 1.8, overflow: "linebreak", valign: "middle" },
          headStyles: { fillColor: [16, 70, 140], textColor: [255, 255, 255], halign: "center", fontStyle: "bold", fontSize: 8 },
          footStyles: { fillColor: [230, 240, 255], textColor: [16, 70, 140], halign: "center", fontStyle: "bold", fontSize: 8 },
          columnStyles: { 0: { cellWidth: 12, halign: "center" }, 1: { cellWidth: 100, halign: "left" }, 2: { cellWidth: 25, halign: "center", fontStyle: "bold" }, 3: { cellWidth: 30, halign: "right", fontStyle: "bold" } },
          margin: { top: 26, left: 8, right: 8 },
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
        doc.save("Bienes_Sobrantes_Por_Rubro.pdf");
        toast({ title: "Reporte generado", description: `Se exportaron ${allActivos.length} activos en ${rubrosOrdenados.length} rubros.` });
        return;
      }

      const body = allActivos.map((a, idx) => {
        const codigoActivo = a.codigoActivo ?? a.codigoactivo;
        const tipoRubroAct = a.tipoRubroAct ?? a.tiporubroact;
        const rubroDesc = rubroFromTipo[tipoRubroAct] ?? rubroFromTipo[String(tipoRubroAct)] ?? "—";
        const tipoDesc = tipoRubroDescMap[tipoRubroAct] ?? tipoRubroDescMap[String(tipoRubroAct)] ?? "—";
        const ambCode = String(a.codigoAmbiente ?? a.codigoambiente ?? "").trim();
        const ciRaw = String(a.cirun ?? "").trim();
        const revaluo = parseNumBE(a.valorRevaluo ?? a.valorrevaluo);
        return [
          String(idx + 1),
          codigoActivo != null ? `OJ-02-${codigoActivo}` : "—",
          String(rubroDesc || "—"),
          String(tipoDesc || "—"),
          String(a.descripcionActivo ?? a.descripcionactivo ?? "—"),
          String(ubicacionMap[ambCode] || ambCode || "—"),
          String(responsableNameOf(ciRaw)),
          ciRaw || "—",
          fmtMoneyBE(revaluo),
        ];
      });

      toast({ title: "Generando PDF", description: `Construyendo reporte con ${allActivos.length} activos...` });

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      addLogo(doc);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("BIENES SOBRANTES - ÓRGANO JUDICIAL", pageWidth / 2, 16, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Total bienes sobrantes: ${allActivos.length}`, pageWidth / 2, 21, { align: "center" });

      autoTable(doc, {
        startY: 26,
        head: [["N°", "Código Activo", "Rubro", "Tipo Rubro", "Descripción", "Ubicación", "Responsable", "Carnet", "Valor Revaluado"]],
        body,
        foot: [["", "", "", "", "", "", "", "TOTAL", fmtMoneyBE(totalRevaluo)]],
        showFoot: "lastPage",
        theme: "striped",
        styles: { font: "helvetica", fontSize: 7, cellPadding: 1.5, overflow: "linebreak", valign: "middle" },
        headStyles: { fillColor: [16, 70, 140], textColor: [255, 255, 255], halign: "center", fontStyle: "bold", fontSize: 7 },
        footStyles: { fillColor: [230, 240, 255], textColor: [16, 70, 140], halign: "center", fontStyle: "bold", fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 16, halign: "center" },
          2: { cellWidth: 34, halign: "left" },
          3: { cellWidth: 34, halign: "left" },
          4: { cellWidth: 58, halign: "left" },
          5: { cellWidth: 38, halign: "left" },
          6: { cellWidth: 30, halign: "left" },
          7: { cellWidth: 14, halign: "center" },
          8: { cellWidth: 20, halign: "right" },
        },
        margin: { top: 26, left: 8, right: 8 },
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

      doc.save("Bienes_Sobrantes.pdf");
      toast({ title: "Reporte generado", description: `Se exportaron ${allActivos.length} bienes sobrantes.` });
    } catch (err) {
      console.error("Error generando Bienes Sobrantes", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
