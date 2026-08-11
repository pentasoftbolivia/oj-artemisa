import { useState, useEffect, useCallback } from "react";
import JsBarcode from "jsbarcode";
import { jsPDF } from "jspdf";
import { generateQRLabel } from "../helpers/generateQRLabel";
import { useToast } from "@/hooks/use-toast";
import { buildDenominacion } from "@/lib/utils";
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
  const descripcion = buildDenominacion(item, rubro);
  const estado = resolveEstadoConservacion(item);
  const qrContent = `${codigoActivo}|${rubro}|${tipo}|${descripcion}|${estado}`;
  return { codigoActivo, rubro, tipo, qrContent };
};

export const useBarcodeQR = ({ rubroMap, tipoRubroMap, activosFijos = [] }) => {
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
    if (!activosFijos.length) return;
    const revisados = activosFijos.filter(
      (a) => String(a.estadoinventario ?? "").toUpperCase() === "REVISADO",
    );
    if (revisados.length === 0) {
      toast({
        title: "Sin activos",
        description: "No hay activos en estado REVISADO para generar QRs.",
        variant: "destructive",
      });
      return;
    }
    setIsGeneratingQrs(true);
    try {
      const labels = await generateBulkQRLabels(revisados);
      setQrLabels(labels);
      setIsQrPrintOpen(true);
    } catch (err) {
      toast({
        title: "Error",
        description: `Fallo al generar QRs: ${err.message || "Error desconocido"}`,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingQrs(false);
    }
  }, [activosFijos, generateBulkQRLabels, toast]);

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
