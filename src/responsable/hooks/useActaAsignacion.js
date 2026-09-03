import { useState, useCallback } from "react";
import { useDispatch } from "react-redux";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/lib/supabase";
import { getCachedCatalog } from "@/lib/catalogCache";
import { buildDenominacion } from "@/lib/utils";
import { toCamelCaseArray } from "@/lib/mapFields";
import { useToast } from "@/hooks/use-toast";
import { resolveAmbienteCodes } from "../services/responsableUbicacionService";
import { getNumeroActa } from "../services/responsableActaService";
import { fetchResponsable } from "@/store/responsable/responsableThunks";

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

const ASSET_SELECT =
  "codigoactivo, codigoambiente, tiporubroact, descripcionactivo, observaciones, marcamaterial, modelo, serie, ram, procesador, discoduro, numeromotor, numerochasisserial, placamatricula, capacidadcargatraccion, capacidaddimension, fuentealimentacion, accesorios, alcancecobertura, medidas, color, divisionescajonesbandejas, chapa, abatible, deslizable, potencia, horometro, combustibleenergia, funcion, categoria, caracteristicas, estadoconservacion";

const loadImage = (src) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

export const loadActaData = async (responsable, locationFilters = {}) => {
  const { ciudad, inmueble, nivel, ambiente } = locationFilters || {};
  const hasLocation = Boolean(ciudad || inmueble || nivel || ambiente);

  let query = supabase
    .from("act_activos")
    .select(ASSET_SELECT)
    .eq("cirun", responsable.cirun)
    .eq("ultimoregistro", 1)
    .eq("estadoinventario", "INVENTARIADO");

  if (hasLocation) {
    const codes = await resolveAmbienteCodes({ ciudad, inmueble, nivel, ambiente });
    if (codes.length === 0) {
      return { assets: [], numeroActa: null, tipoRubroMap: {}, descTipoRubroMap: {}, resolveUbicacion: () => "" };
    }
    query = query.in("codigoambiente", codes);
  }

  const { data: rawAssets, error: assetsError } = await query.order("codigoactivo", { ascending: true });

  if (assetsError) throw assetsError;

  const assets = toCamelCaseArray(rawAssets || []);

  if (assets.length === 0) {
    return { assets, tipoRubroMap: {}, descTipoRubroMap: {}, resolveUbicacion: () => "" };
  }

  const [tipoRubros, rubros, ambData, nData, iData, cData] = await Promise.all([
    getCachedCatalog("act_tiporubro"),
    getCachedCatalog("act_rubro"),
    getCachedCatalog("act_ambiente"),
    getCachedCatalog("act_nivel"),
    getCachedCatalog("act_inmueble"),
    getCachedCatalog("act_ciudad")
  ]);

  const rubroMap = {};
  (rubros || []).forEach(r => rubroMap[r.codigorubroact] = r.descripcionrubroact);

  const tipoRubroMap = {};
  const descTipoRubroMap = {};
  (tipoRubros || []).forEach(tr => {
    tipoRubroMap[tr.tiporubroact] = rubroMap[tr.codigorubroact];
    descTipoRubroMap[tr.tiporubroact] = tr.descripciontiporubroact;
  });

  const ambienteMap = {};
  const ambienteNivelMap = {};
  if (ambData && ambData.length) {
    ambData.forEach(a => {
      ambienteMap[String(a.codigoambiente).trim()] = a.ambiente;
      ambienteNivelMap[String(a.codigoambiente).trim()] = a.codigonivel;
    });
  }

  const nivelMap = {};
  const nivelInmuebleMap = {};
  if (nData && nData.length) {
    nData.forEach(n => {
      nivelMap[String(n.codigonivel).trim()] = n.nivel;
      nivelInmuebleMap[String(n.codigonivel).trim()] = n.codigoinmueble;
    });
  }

  const inmuebleMap = {};
  const inmuebleCiudadMap = {};
  if (iData && iData.length) {
    iData.forEach(i => {
      inmuebleMap[String(i.codigoinmueble).trim()] = i.inmueble;
      inmuebleCiudadMap[String(i.codigoinmueble).trim()] = i.codigociudad;
    });
  }

  const ciudadMap = {};
  if (cData && cData.length) {
    cData.forEach(c => ciudadMap[String(c.codigociudad).trim()] = c.descripcion);
  }

  const resolveUbicacion = (codigoAmbiente) => {
    const ca = String(codigoAmbiente || "").trim();
    if (!ca) return "";
    const ambiente = (ambienteMap[ca] || "").trim();
    const codNivel = String(ambienteNivelMap[ca] || "").trim();
    const nivel = codNivel ? (nivelMap[codNivel] || "").trim() : "";
    const codInmueble = codNivel ? String(nivelInmuebleMap[codNivel] || "").trim() : "";
    const inmueble = codInmueble ? (inmuebleMap[codInmueble] || "").trim() : "";
    const codCiudad = codInmueble ? String(inmuebleCiudadMap[codInmueble] || "").trim() : "";
    const ciudad = codCiudad ? (ciudadMap[codCiudad] || "").trim() : "";
    return [ciudad, inmueble, nivel, ambiente].filter(Boolean).join(", ");
  };

  return { assets, tipoRubroMap, descTipoRubroMap, resolveUbicacion };
};

const DISCLAIMER =
  "En señal de conformidad y aceptación se firma el presente acta. El servidor público queda prohibido de usar o permitir el uso de los bienes para beneficio particular o privado, prestar o transferir el bien a otro empleado público, enajenar el bien por cuenta propia, dañar o alterar sus características físicas o técnicas, poner en riesgo el bien, ingresar o sacar bienes particulares sin autorización de la Unidad o Responsable de Activos Fijos. La no observancia a estas prohibiciones generará responsabilidades establecidas en la Ley N° 1178 y sus reglamentos.";

const drawActaHeader = async (doc, { numeroActa, responsable }) => {
  const pageWidth = doc.internal.pageSize.getWidth();

  const fullName = `${responsable.nombre1 || ""} ${responsable.nombre2 || ""} ${responsable.paterno || ""} ${responsable.materno || ""}`.replace(/\s+/g, ' ').trim();

  const logoUrl = `${window.location.origin}/logo-oj.png`;
  const logoImg = await loadImage(logoUrl);
  if (logoImg) {
    const canvas = document.createElement("canvas");
    canvas.width = logoImg.naturalWidth;
    canvas.height = logoImg.naturalHeight;
    canvas.getContext("2d").drawImage(logoImg, 0, 0);
    const logoDataUrl = canvas.toDataURL("image/png");
    const logoWidth = 30;
    const logoHeight = logoWidth * (logoImg.naturalHeight / logoImg.naturalWidth);
    doc.addImage(logoDataUrl, "PNG", 14, 8, logoWidth, logoHeight);
  }

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("ASIGNACIÓN INDIVIDUAL DE BIENES", pageWidth / 2, 20, { align: "center" });

  doc.setFontSize(9);
  doc.text(`ACTA No. ${numeroActa}`, pageWidth / 2, 23.5, { align: "center" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  const printDateStr = new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).toUpperCase();

  doc.text(`FECHA DE IMPRESIÓN: ${printDateStr}`, pageWidth / 2, 27, { align: "center" });

  const startYInfo = 40;
  const col1 = 14;
  const col2 = 45;
  const col3 = 140;
  const col4 = 165;

  doc.setFont("helvetica", "bold");
  doc.text("ENTIDAD:", col1, startYInfo);
  doc.setFont("helvetica", "normal");
  doc.text("Órgano Judicial - La Paz", col2, startYInfo);

  const infoY = startYInfo + 6;

  doc.setFont("helvetica", "bold");
  doc.text("RESPONSABLE:", col1, infoY);
  doc.setFont("helvetica", "normal");
  doc.text(fullName, col2, infoY);

  doc.setFont("helvetica", "bold");
  doc.text("CARGO:", col1, infoY + 6);
  doc.setFont("helvetica", "normal");
  const splitCargo = doc.splitTextToSize(String(responsable.cargo || "—"), 90);
  doc.text(splitCargo, col2, infoY + 6);

  doc.setFont("helvetica", "bold");
  doc.text("C.I.:", col3, startYInfo + 6);
  doc.setFont("helvetica", "normal");
  doc.text(String(responsable.cirun || "—"), col4, startYInfo + 6);

  doc.setFont("helvetica", "bold");
  doc.text("ESTADO:", col3, infoY + 6);
  doc.setFont("helvetica", "normal");
  doc.text("CONSOLIDADO", col4, infoY + 6);

  const tableStartY = infoY + 6 + (splitCargo.length * 4) + 5;

  return { tableStartY, pageWidth };
};

const drawSignatureFooter = (doc, { finalY, cantidad, pageWidth, responsable }) => {
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`Cantidad: ${cantidad}`, 14, finalY + 8);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  const splitDisclaimer = doc.splitTextToSize(DISCLAIMER, pageWidth - 28);
  doc.text(splitDisclaimer, 14, finalY + 15);

  const sigY = finalY + 15 + (splitDisclaimer.length * 3) + 25;

  const sigLeft = (pageWidth - 170) / 2;
  const sigLabels = [
    { x: sigLeft + 25, label: "Responsable de Activos Fijos" },
    { x: sigLeft + 90, label: "Autorización de Asignación" },
    { x: sigLeft + 150, label: "Funcionario" },
  ];

  const drawSignatures = (y) => {
    sigLabels.forEach(({ x, label }, i) => {
      doc.line(sigLeft + (i * 60), y, sigLeft + (i * 60) + 50, y);
      doc.text(label, x, y + 4, { align: "center" });

      if (i === 2 && responsable) {
        const fullName = `${responsable.nombre1 || ""} ${responsable.nombre2 || ""} ${responsable.paterno || ""} ${responsable.materno || ""}`.replace(/\s+/g, " ").trim();
        const nameLines = doc.splitTextToSize(fullName || "—", 50);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text(nameLines, x, y + 10, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.text(`C.I.: ${String(responsable.cirun || "—")}`, x, y + 10 + nameLines.length * 3 + 2, { align: "center" });
      }
    });
  };

  if (sigY > doc.internal.pageSize.getHeight() - 20) {
    doc.addPage();
    drawSignatures(40);
  } else {
    drawSignatures(sigY);
  }
};

const drawPageNumbers = (doc) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const totalPages = doc.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: "center" });
  }
};

export const useActaAsignacion = () => {
  const { toast } = useToast();
  const dispatch = useDispatch();
  const [isPrinting, setIsPrinting] = useState(false);
  const [printingId, setPrintingId] = useState(null);

  const refreshResponsables = useCallback(() => {
    dispatch(fetchResponsable());
  }, [dispatch]);

  const printActaAsignacion = useCallback(async (responsable, locationFilters = {}) => {
    if (!responsable?.cirun) return;

    setIsPrinting(true);
    setPrintingId(responsable.cirun);

    try {
      const { assets, tipoRubroMap, descTipoRubroMap, resolveUbicacion } = await loadActaData(responsable, locationFilters);

      if (assets.length === 0) {
        toast({
          title: "Sin activos",
          description: "El funcionario no tiene activos asignados vigentes.",
          variant: "destructive",
        });
        return;
      }

      const numeroActa = await getNumeroActa(responsable, locationFilters);

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "letter"
      });

      doc.setFont("helvetica");

      const { tableStartY } = await drawActaHeader(doc, { numeroActa, responsable });

      const sanitize = (s) => String(s ?? "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").replace(/\s+/g, " ").trim();
      const tableData = assets.map(a => {
        const trId = a.tipoRubroAct || a.tiporubroact;
        const rn = sanitize(tipoRubroMap[trId] || "");
        const tn = sanitize(descTipoRubroMap[trId] || "");
        const desc = sanitize(buildDenominacion(a, rn) || "");
        const rawObs = sanitize(a.observaciones || "");
        const rawDescActivo = sanitize(a.descripcionActivo || a.descripcionactivo || "");
        const obs = rawObs && (rawObs === "0" || rawObs === rawDescActivo || rawObs === desc) ? "" : rawObs;
        const codigoFormateado = `OJ-02-${sanitize(a.codigoActivo || a.codigoactivo || "")}`;
        const ubicacion = sanitize(resolveUbicacion(a.codigoAmbiente || a.codigoambiente) || "");

        return [
          codigoFormateado,
          rn,
          tn,
          desc,
          obs,
          ubicacion,
          sanitize(a.estadoConservacion || a.estadoconservacion || "REGULAR").toUpperCase() || "REGULAR"
        ];
      });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);

      autoTable(doc, {
        startY: tableStartY,
        head: [['CÓDIGO', 'RUBRO', 'TIPO', 'DESCRIPCIÓN', 'OBSERVACIONES', 'UBICACIÓN', 'ESTADO']],
        body: tableData,
        theme: 'plain',
        tableWidth: 'wrap',
        styles: {
          font: 'helvetica',
          fontSize: 7.5,
          fontStyle: 'normal',
          cellPadding: 1.2,
          minCellHeight: 4.5,
          overflow: 'linebreak',
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
          valign: 'top',
        },
        headStyles: {
          fontStyle: 'bold',
          fillColor: [240, 240, 240],
          textColor: [0, 0, 0],
          halign: 'center',
          valign: 'middle',
        },
        bodyStyles: {
          overflow: 'linebreak',
          valign: 'top',
        },
        columnStyles: {
          0: { cellWidth: 20, overflow: 'linebreak' },
          1: { cellWidth: 26, overflow: 'linebreak' },
          2: { cellWidth: 20, overflow: 'linebreak' },
          3: { cellWidth: 78, overflow: 'linebreak' },
          4: { cellWidth: 38, overflow: 'linebreak' },
          5: { cellWidth: 42, overflow: 'linebreak' },
          6: { cellWidth: 18, halign: 'center', overflow: 'linebreak' }
        },
        margin: { top: 20, left: 14, right: 14 },
        horizontalPageBreak: false,
        didParseCell: (hookData) => {
          // Fuerza wrap mid-word para columnas que pueden desbordar (RUBRO,TIPO,DESCRIPCIÓN,OBSERVACIONES,UBICACIÓN)
          if ([1, 2, 3, 4, 5].includes(hookData.column.index)) {
            const colWidth = (hookData.column.width || hookData.cell.width || 0);
            const maxWidth = colWidth > 5 ? colWidth - 2.4 - 0.5 : 0;
            const raw = hookData.cell.text.join(' ');
            if (raw && maxWidth > 5) {
              hookData.cell.text = doc.splitTextToSize(raw, maxWidth);
            }
          }
        },
      });

      const finalY = doc.lastAutoTable.finalY;

      const pageWidth = doc.internal.pageSize.getWidth();
      drawSignatureFooter(doc, { finalY, cantidad: assets.length, pageWidth, responsable });
      drawPageNumbers(doc);

      doc.save(`Acta_Asignacion_${responsable.cirun}.pdf`);

      toast({
        title: "Acta generada",
        description: `Se descargó el acta de asignación para ${responsable.cirun}`,
      });
      refreshResponsables();

    } catch (err) {
      console.error("Error al generar acta:", err);
      const errorMsg = formatError(err);
      toast({
        title: "Error",
        description: `Hubo un problema al generar el acta: ${errorMsg}`,
        variant: "destructive",
      });
    } finally {
      setIsPrinting(false);
      setPrintingId(null);
    }
  }, [toast, refreshResponsables]);

  const printActaListado = useCallback(async (responsable, locationFilters = {}) => {
    if (!responsable?.cirun) return;

    setIsPrinting(true);
    setPrintingId(`${responsable.cirun}:listado`);

    try {
      const { assets, tipoRubroMap, descTipoRubroMap, resolveUbicacion } = await loadActaData(responsable, locationFilters);

      if (assets.length === 0) {
        toast({
          title: "Sin activos",
          description: "El funcionario no tiene activos asignados vigentes.",
          variant: "destructive",
        });
        return;
      }

      const numeroActa = await getNumeroActa(responsable, locationFilters);

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "letter"
      });

      doc.setFont("helvetica");

      const { tableStartY, pageWidth } = await drawActaHeader(doc, { numeroActa, responsable });

      const sanitize2 = (s) => String(s ?? "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").replace(/\s+/g, " ").trim();
      const lineas = assets.map(a => {
        const trId = a.tipoRubroAct || a.tiporubroact;
        const rn = sanitize2(tipoRubroMap[trId] || "");
        const tn = sanitize2(descTipoRubroMap[trId] || "");
        const desc = sanitize2(buildDenominacion(a, rn) || "");
        const rawObs = sanitize2(a.observaciones || "");
        const rawDescActivo = sanitize2(a.descripcionActivo || a.descripcionactivo || "");
        const obs = rawObs && (rawObs === "0" || rawObs === rawDescActivo || rawObs === desc) ? "" : rawObs;
        const codigo = `OJ-02-${sanitize2(a.codigoActivo || a.codigoactivo || "")}`;
        const ubicacion = sanitize2(resolveUbicacion(a.codigoAmbiente || a.codigoambiente) || "");
        const estado = sanitize2(a.estadoConservacion || a.estadoconservacion || "REGULAR").toUpperCase() || "REGULAR";
        return [codigo, rn, tn, desc, obs, ubicacion, estado].join(";");
      });

      const marginX = 14;
      const maxWidth = pageWidth - 28;
      const pageHeight = doc.internal.pageSize.getHeight();
      const lineHeight = 4;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);

      let y = tableStartY;
      for (const linea of lineas) {
        const wrapped = doc.splitTextToSize(linea, maxWidth);
        const blockHeight = wrapped.length * lineHeight + 3;
        if (y + blockHeight > pageHeight - 20) {
          doc.addPage();
          y = 40;
        }
        doc.text(wrapped, marginX, y);
        y += blockHeight;
      }

      drawSignatureFooter(doc, { finalY: y, cantidad: assets.length, pageWidth, responsable });
      drawPageNumbers(doc);

      doc.save(`Acta_Asignacion_${responsable.cirun}_listado.pdf`);

      toast({
        title: "Listado generado",
        description: `Se descargó el listado de activos para ${responsable.cirun}`,
      });
      refreshResponsables();

    } catch (err) {
      console.error("Error al generar listado:", err);
      const errorMsg = formatError(err);
      toast({
        title: "Error",
        description: `Hubo un problema al generar el listado: ${errorMsg}`,
        variant: "destructive",
      });
    } finally {
      setIsPrinting(false);
      setPrintingId(null);
    }
  }, [toast, refreshResponsables]);

  return {
    printActaAsignacion,
    printActaListado,
    isPrinting,
    printingId
  };
};