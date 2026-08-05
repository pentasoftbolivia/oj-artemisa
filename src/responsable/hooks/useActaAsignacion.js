import { useState, useCallback } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase, fetchAllFromTable } from "@/lib/supabase";
import { buildDenominacion } from "@/lib/utils";
import { toCamelCaseArray } from "@/lib/mapFields";
import { useToast } from "@/hooks/use-toast";

const ASSET_SELECT =
  "codigoactivo, codigoambiente, tiporubroact, descripcionactivo, observaciones, marcamaterial, modelo, serie, ram, procesador, discoduro, numeromotor, numerochasisserial, placamatricula, capacidadcargatraccion, capacidaddimension, fuentealimentacion, accesorios, alcancecobertura, medidas, color, divisionescajonesbandejas, chapa, abatible, deslizable, potencia, horometro, combustibleenergia, funcion, categoria, caracteristicas, estadoconservacion";

const loadImage = (src) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

const loadActaData = async (responsable) => {
  const { data: rawAssets, error: assetsError } = await supabase
    .from("act_activos")
    .select(ASSET_SELECT)
    .eq("cirun", responsable.cirun)
    .eq("ultimoregistro", 1)
    .not("estadoinventario", "is", null)
    .order("codigoactivo", { ascending: true });

  if (assetsError) throw assetsError;

  const assets = toCamelCaseArray(rawAssets || []);

  if (assets.length === 0) {
    return { assets, numeroActa: null, tipoRubroMap: {}, descTipoRubroMap: {}, resolveUbicacion: () => "" };
  }

  const [trRes, rRes, ambData, nData, iData, cData] = await Promise.all([
    supabase.from("act_tiporubro").select("tiporubroact, codigorubroact, descripciontiporubroact"),
    supabase.from("act_rubro").select("codigorubroact, descripcionrubroact"),
    fetchAllFromTable("act_ambiente", "codigoambiente, ambiente, codigonivel", { orderColumn: "codigoambiente" }),
    fetchAllFromTable("act_nivel", "codigonivel, nivel, codigoinmueble", { orderColumn: "codigonivel" }),
    fetchAllFromTable("act_inmueble", "codigoinmueble, inmueble, codigociudad", { orderColumn: "codigoinmueble" }),
    fetchAllFromTable("act_ciudad", "codigociudad, descripcion", { orderColumn: "codigociudad" })
  ]);

  const rubroMap = {};
  if (!rRes.error) {
    rRes.data.forEach(r => rubroMap[r.codigorubroact] = r.descripcionrubroact);
  }

  const tipoRubroMap = {};
  const descTipoRubroMap = {};
  if (!trRes.error) {
    trRes.data.forEach(tr => {
      tipoRubroMap[tr.tiporubroact] = rubroMap[tr.codigorubroact];
      descTipoRubroMap[tr.tiporubroact] = tr.descripciontiporubroact;
    });
  }

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

  const { data: respRow, error: respError } = await supabase
    .from("act_responsable")
    .select("numeroacta")
    .eq("cirun", responsable.cirun)
    .maybeSingle();

  if (respError) throw respError;

  const numeroExistente = Number(respRow?.numeroacta) || 0;
  let numeroActa = numeroExistente;

  if (!numeroExistente) {
    const { data: contadorRows, error: contadorError } = await supabase
      .from("act_contadores")
      .select("id, numeroacta")
      .order("numeroacta", { ascending: false })
      .limit(1);

    if (contadorError) throw contadorError;

    numeroActa = (Number(contadorRows && contadorRows[0]?.numeroacta) || 0) + 1;

    if (contadorRows && contadorRows[0]?.id != null) {
      const { error: updateError } = await supabase
        .from("act_contadores")
        .update({ numeroacta: numeroActa })
        .eq("id", contadorRows[0].id);
      if (updateError) throw updateError;
    }

    const { error: respUpdateError } = await supabase
      .from("act_responsable")
      .update({ numeroacta: numeroActa })
      .eq("cirun", responsable.cirun);
    if (respUpdateError) throw respUpdateError;
  }

  return { assets, numeroActa, tipoRubroMap, descTipoRubroMap, resolveUbicacion };
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

const drawSignatureFooter = (doc, { finalY, cantidad, pageWidth }) => {
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
  const [isPrinting, setIsPrinting] = useState(false);
  const [printingId, setPrintingId] = useState(null);

  const printActaAsignacion = useCallback(async (responsable) => {
    if (!responsable?.cirun) return;

    setIsPrinting(true);
    setPrintingId(responsable.cirun);

    try {
      const { assets, numeroActa, tipoRubroMap, descTipoRubroMap, resolveUbicacion } = await loadActaData(responsable);

      if (assets.length === 0) {
        toast({
          title: "Sin activos",
          description: "El funcionario no tiene activos asignados vigentes.",
          variant: "destructive",
        });
        return;
      }

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
      drawSignatureFooter(doc, { finalY, cantidad: assets.length, pageWidth });
      drawPageNumbers(doc);

      doc.save(`Acta_Asignacion_${responsable.cirun}.pdf`);

      toast({
        title: "Acta generada",
        description: `Se descargó el acta de asignación para ${responsable.cirun}`,
      });

    } catch (err) {
      console.error("Error al generar acta:", err);
      const errorMsg = err?.message || err?.details || err?.error_description || JSON.stringify(err);
      toast({
        title: "Error",
        description: `Hubo un problema al generar el acta: ${errorMsg}`,
        variant: "destructive",
      });
    } finally {
      setIsPrinting(false);
      setPrintingId(null);
    }
  }, [toast]);

  const printActaListado = useCallback(async (responsable) => {
    if (!responsable?.cirun) return;

    setIsPrinting(true);
    setPrintingId(`${responsable.cirun}:listado`);

    try {
      const { assets, numeroActa, tipoRubroMap, descTipoRubroMap, resolveUbicacion } = await loadActaData(responsable);

      if (assets.length === 0) {
        toast({
          title: "Sin activos",
          description: "El funcionario no tiene activos asignados vigentes.",
          variant: "destructive",
        });
        return;
      }

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

      drawSignatureFooter(doc, { finalY: y, cantidad: assets.length, pageWidth });
      drawPageNumbers(doc);

      doc.save(`Acta_Asignacion_${responsable.cirun}_listado.pdf`);

      toast({
        title: "Listado generado",
        description: `Se descargó el listado de activos para ${responsable.cirun}`,
      });

    } catch (err) {
      console.error("Error al generar listado:", err);
      const errorMsg = err?.message || err?.details || err?.error_description || JSON.stringify(err);
      toast({
        title: "Error",
        description: `Hubo un problema al generar el listado: ${errorMsg}`,
        variant: "destructive",
      });
    } finally {
      setIsPrinting(false);
      setPrintingId(null);
    }
  }, [toast]);

  return {
    printActaAsignacion,
    printActaListado,
    isPrinting,
    printingId
  };
};