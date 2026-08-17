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
    .not("estadoinventario", "is", null);

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

      const tableData = assets.map(a => {
        const trId = a.tipoRubroAct || a.tiporubroact;
        const rn = (tipoRubroMap[trId] || "").trim();
        const tn = (descTipoRubroMap[trId] || "").trim();
        const desc = (buildDenominacion(a, rn) || "").trim();
        const obs = (a.observaciones || "").toString().trim();
        const codigoFormateado = `OJ-02-${(a.codigoActivo || a.codigoactivo || "").toString().trim()}`;
        const ubicacion = (resolveUbicacion(a.codigoAmbiente || a.codigoambiente) || "").trim();

        return [
          codigoFormateado,
          rn,
          tn,
          desc,
          obs,
          ubicacion,
          (a.estadoConservacion || a.estadoconservacion || "REGULAR").toString().trim().toUpperCase()
        ];
      });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);

      autoTable(doc, {
        startY: tableStartY,
        head: [['CÓDIGO', 'RUBRO', 'TIPO', 'DESCRIPCIÓN', 'OBSERVACIONES', 'UBICACIÓN', 'ESTADO']],
        body: tableData,
        theme: 'plain',
        styles: {
          font: 'helvetica',
          fontSize: 8,
          fontStyle: 'normal',
          cellPadding: 1.2,
          minCellHeight: 4.5,
          overflow: 'linebreak',
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
        },
        headStyles: {
          fontStyle: 'bold',
          fillColor: [240, 240, 240],
          textColor: [0, 0, 0],
          halign: 'center'
        },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 22 },
          2: { cellWidth: 22 },
          3: { cellWidth: 'auto' },
          4: { cellWidth: 38 },
          5: { cellWidth: 48 },
          6: { cellWidth: 20, halign: 'center' }
        },
        margin: { top: 20, left: 14, right: 14 }
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

      const lineas = assets.map(a => {
        const trId = a.tipoRubroAct || a.tiporubroact;
        const rn = (tipoRubroMap[trId] || "").trim();
        const tn = (descTipoRubroMap[trId] || "").trim();
        const desc = (buildDenominacion(a, rn) || "").trim();
        const obs = (a.observaciones || "").toString().trim();
        const codigo = `OJ-02-${(a.codigoActivo || a.codigoactivo || "").toString().trim()}`;
        const ubicacion = (resolveUbicacion(a.codigoAmbiente || a.codigoambiente) || "").trim();
        const estado = (a.estadoConservacion || a.estadoconservacion || "REGULAR").toString().trim().toUpperCase();
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