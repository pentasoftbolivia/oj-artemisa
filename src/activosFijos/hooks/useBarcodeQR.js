import { useState, useEffect, useCallback } from "react";
import JsBarcode from "jsbarcode";
import { jsPDF } from "jspdf";
import { generateQRLabel } from "../helpers/generateQRLabel";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { toCamelCaseArray } from "@/lib/mapFields";
import { resolveAmbienteCodes } from "@/lib/ubicacionFilters";
const formatCodigoActivo = (a) =>
  a?.codigoActivo != null ? `OJ-02-${a.codigoActivo}` : "";

const ESTADO_CONSERVACION_MAP = {
  1: "Bueno",
  2: "Regular",
  3: "Malo",
  BUENO: "Bueno",
  REGULAR: "Regular",
  MALO: "Malo",
};

const resolveEstadoConservacion = (a) => {
  const raw = a?.estadoConservacion ?? a?.estadoconservacion ?? "";
  if (raw === null || raw === undefined || raw === "") return "";
  return ESTADO_CONSERVACION_MAP[String(raw).trim().toUpperCase()] ?? String(raw).trim() ?? "";
};

const buildQrFields = (item, rubroMap, tipoRubroMap) => {
  const codigoActivo = formatCodigoActivo(item);
  const rubro = (rubroMap[item.tipoRubroAct] ?? rubroMap[item.tiporubroact] ?? item.tipoRubroAct ?? item.tiporubroact ?? "").toString().trim();
  const tipo = (tipoRubroMap[item.tipoRubroAct] ?? tipoRubroMap[item.tiporubroact] ?? item.descripciontiporubroact ?? "").toString().trim();
  const descripcion = String(item.descripcionActivo ?? item.descripcionactivo ?? "").trim();
  const qrContent = `${codigoActivo}|${rubro}|${tipo}|${descripcion}`;
  return { codigoActivo, rubro, tipo, qrContent };
};

export const useBarcodeQR = ({ rubroMap, tipoRubroMap, activosFijos = [], appliedFilters = null, rubroToTipoIds = {} }) => {
  const { toast } = useToast();

  const [barcodeActivo, setBarcodeActivo] = useState(null);
  const [qrActivo, setQrActivo] = useState(null);
  const [barcodeDataUrl, setBarcodeDataUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [isQrPrintOpen, setIsQrPrintOpen] = useState(false);
  const [qrLabels, setQrLabels] = useState([]);
  const [isGeneratingQrs, setIsGeneratingQrs] = useState(false);

  useEffect(() => {
    if (!barcodeActivo) return;
    const canvas = document.createElement("canvas");
    JsBarcode(canvas, formatCodigoActivo(barcodeActivo), {
      format: "CODE128",
      width: 1.5,
      height: 40,
      displayValue: true,
      fontSize: 12,
      margin: 5,
    });
    setBarcodeDataUrl(canvas.toDataURL("image/png"));
  }, [barcodeActivo]);

  useEffect(() => {
    if (!qrActivo) return;
    const { codigoActivo, rubro, tipo, qrContent } = buildQrFields(qrActivo, rubroMap, tipoRubroMap);

    generateQRLabel({
      qrContent,
      codigoActivo,
      rubro,
      tipo,
      fecha: new Date().toLocaleDateString("es-ES"),
    }).then(setQrDataUrl);
  }, [qrActivo, rubroMap, tipoRubroMap]);

  const printBarcodePDF = useCallback(() => {
    if (!barcodeDataUrl || !barcodeActivo) return;
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: [50, 25],
    });
    doc.addImage(barcodeDataUrl, "PNG", 3, 3, 44, 14);
    doc.setFontSize(8);
    doc.text(formatCodigoActivo(barcodeActivo), 25, 21, {
      align: "center",
    });
    doc.save(`codigo-barras-${barcodeActivo.codigoActivo}.pdf`);
  }, [barcodeDataUrl, barcodeActivo]);

  const printQRPDF = useCallback(() => {
    if (!qrDataUrl || !qrActivo) return;
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: [50, 25],
    });
    doc.addImage(qrDataUrl, "PNG", 0, 0, 50, 25);
    doc.save(`codigo-qr-${qrActivo.codigoActivo}.pdf`);
  }, [qrDataUrl, qrActivo]);

  const generateBulkQRLabels = useCallback(
    async (items) => {
      const labels = [];
      for (const item of items) {
        const { codigoActivo, rubro, tipo, qrContent } = buildQrFields(item, rubroMap, tipoRubroMap);

        const dataUrl = await generateQRLabel({
          qrContent,
          codigoActivo,
          rubro,
          tipo,
          fecha: new Date().toLocaleDateString("es-ES"),
        });
        labels.push({ codigoActivo, dataUrl });
      }
      return labels;
    },
    [rubroMap, tipoRubroMap],
  );

  const handlePrintQRs = useCallback(async () => {
    // Si hay filtros aplicados, obtener TODOS los activos del ambiente seleccionado (no solo página)
    let itemsToPrint = activosFijos;
    const hasLocationFilter = appliedFilters && (appliedFilters.ambiente || appliedFilters.nivel || appliedFilters.inmueble || appliedFilters.ciudad);
    const hasAnyFilter = appliedFilters && Object.values(appliedFilters).some((v) => String(v ?? "").trim().length > 0);

    if (hasLocationFilter || (hasAnyFilter && activosFijos.length > 0)) {
      // Intentar fetch completo del ambiente/filtros actuales
      try {
        setIsGeneratingQrs(true);
        toast({ title: "Generando QRs...", description: "Obteniendo todos los activos del ambiente seleccionado." });

        const exportFilters = {
          search: appliedFilters.search,
          carnet: appliedFilters.carnet,
          rubro: appliedFilters.rubro ? rubroToTipoIds[appliedFilters.rubro] || [] : undefined,
          ambiente: appliedFilters.ambiente || undefined,
          nivel: appliedFilters.nivel || undefined,
          inmueble: appliedFilters.inmueble || undefined,
          ciudad: appliedFilters.ciudad || undefined,
        };

        let ambienteCodes = null;
        if (!exportFilters.ambiente && (exportFilters.nivel || exportFilters.inmueble || exportFilters.ciudad)) {
          ambienteCodes = await resolveAmbienteCodes({
            ciudad: exportFilters.ciudad,
            inmueble: exportFilters.inmueble,
            nivel: exportFilters.nivel,
          });
        }

        const CHUNK = 1000;
        let from = 0;
        let allData = [];
        while (true) {
          let query = supabase
            .from("act_activos")
            .select("*")
            .eq("ultimoregistro", 1)
            .order("cirun", { ascending: true, nullsFirst: true })
            .order("codigoactivointerno", { ascending: true })
            .range(from, from + CHUNK - 1);

          if (exportFilters.search) {
            const s = exportFilters.search.replace(/%/g, "").trim();
            if (s) {
              const searchNum = Number(s);
              if (!isNaN(searchNum)) {
                query = query.or(`codigoactivo.eq.${searchNum},cirun.ilike.%${s}%`);
              } else {
                const words = s.split(/\s+/).filter(Boolean);
                words.forEach((word) => {
                  query = query.or(`descripcionactivo.ilike.%${word}%,cirun.ilike.%${word}%`);
                });
              }
            }
          }
          if (exportFilters.carnet) {
            const c = exportFilters.carnet.replace(/%/g, "").trim();
            if (c) {
              const words = c.split(/\s+/).filter(Boolean);
              words.forEach((word) => {
                query = query.ilike("cirun", `%${word}%`);
              });
            }
          }
          if (exportFilters.rubro && Array.isArray(exportFilters.rubro)) {
            query = query.in("tiporubroact", exportFilters.rubro.length > 0 ? exportFilters.rubro : [-1]);
          }
          if (exportFilters.ambiente) {
            query = query.eq("codigoambiente", exportFilters.ambiente);
          } else if (ambienteCodes) {
            query = query.in("codigoambiente", ambienteCodes && ambienteCodes.length > 0 ? ambienteCodes : [-1]);
          }

          const { data, error } = await query;
          if (error) throw error;
          if (!data || data.length === 0) break;
          allData = allData.concat(toCamelCaseArray(data));
          if (data.length < CHUNK) break;
          from += CHUNK;
          if (from > 100000) break;
        }

        if (allData.length > 0) {
          itemsToPrint = allData;
        } else if (!activosFijos.length) {
          toast({ title: "Sin activos", description: "No se encontraron activos para el ambiente seleccionado.", variant: "destructive" });
          setIsGeneratingQrs(false);
          return;
        }
      } catch (err) {
        // Fallback a lista paginada si falla fetch completo
        console.warn("Fallo fetch completo QR, usando lista paginada:", err);
        itemsToPrint = activosFijos;
        if (!itemsToPrint.length) {
          toast({ title: "Sin activos", description: "No hay activos para generar QRs.", variant: "destructive" });
          setIsGeneratingQrs(false);
          return;
        }
        // continuar con itemsToPrint paginado
      } finally {
        // no cerrar isGeneratingQrs aún, se cierra tras generar labels
      }
    }

    if (!itemsToPrint.length) {
      toast({ title: "Sin activos", description: "No hay activos para generar QRs.", variant: "destructive" });
      return;
    }
    // Si venimos de fetch completo, isGeneratingQrs ya está true
    if (!hasLocationFilter && !hasAnyFilter) {
      setIsGeneratingQrs(true);
    } else if (itemsToPrint === activosFijos) {
      setIsGeneratingQrs(true);
    }
    try {
      const labels = await generateBulkQRLabels(itemsToPrint);
      setQrLabels(labels);
      setIsQrPrintOpen(true);
    } catch (err) {
      toast({ title: "Error", description: `Fallo al generar QRs: ${err.message || "Error desconocido"}`, variant: "destructive" });
    } finally {
      setIsGeneratingQrs(false);
    }
  }, [activosFijos, appliedFilters, rubroToTipoIds, generateBulkQRLabels, toast]);

  const printQRLabels = useCallback(() => {
    if (!qrLabels.length) return;
    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Imprimir QRs</title>
          <style>
            @page { size: auto; margin: 0; }
            html, body { margin: 0; padding: 0; }
            .label { width: 50mm; height: 25mm; display: inline-block; page-break-inside: avoid; }
            .label img { width: 100%; height: 100%; }
          </style>
        </head>
        <body>
          ${qrLabels.map((l) => `<div class="label"><img src="${l.dataUrl}" /></div>`).join("")}
          <script>window.onload = function () { window.focus(); window.print(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [qrLabels]);

  const downloadQRsPDF = useCallback(() => {
    if (!qrLabels.length) return;
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: [50, 25],
    });
    qrLabels.forEach((l, i) => {
      if (i > 0) doc.addPage();
      doc.addImage(l.dataUrl, "PNG", 0, 0, 50, 25);
    });
    doc.save("codigos-qr.pdf");
  }, [qrLabels]);

  return {
    barcodeActivo,
    setBarcodeActivo,
    qrActivo,
    setQrActivo,
    barcodeDataUrl,
    qrDataUrl,
    isQrPrintOpen,
    setIsQrPrintOpen,
    qrLabels,
    isGeneratingQrs,
    printBarcodePDF,
    printQRPDF,
    handlePrintQRs,
    printQRLabels,
    downloadQRsPDF,
  };
};
