import { useState, useCallback, useEffect } from "react";
import { useDispatch } from "react-redux";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/lib/supabase";
import { getCachedCatalog } from "@/lib/catalogCache";
import { toCamelCaseArray } from "@/lib/mapFields";
import { useToast } from "@/hooks/use-toast";
import { resolveAmbienteCodes } from "../services/responsableUbicacionService";
import { getNumeroActa } from "../services/responsableActaService";
import { fetchResponsable } from "@/store/responsable/responsableThunks";
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
    .eq("estadoinventario", "REVISADO");

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

  // Logo principal Órgano Judicial (public/logo.jpg) superior izquierda
  try {
    const logoWidth = 48;
    const logoHeight = logoWidth * (57 / 256);
    doc.addImage(LOGO_JPG_DATA_URL, "JPEG", 14, 8, logoWidth, logoHeight);
  } catch (_) {
    // fallback: intentar logo-oj.png si falla jpg
    const logoUrl = `${window.location.origin}/logo-oj.png`;
    const logoImg = await loadImage(logoUrl);
    if (logoImg) {
      const canvas = document.createElement("canvas");
      canvas.width = logoImg.naturalWidth;
      canvas.height = logoImg.naturalHeight;
      canvas.getContext("2d").drawImage(logoImg, 0, 0);
      const logoDataUrl = canvas.toDataURL("image/png");
      const logoWidth = 48;
      const logoHeight = logoWidth * (logoImg.naturalHeight / logoImg.naturalWidth);
      doc.addImage(logoDataUrl, "PNG", 14, 8, logoWidth, logoHeight);
    }
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
    if (i > 1) {
      try { doc.addImage(LOGO_JPG_DATA_URL, "JPEG", 14, 8, 48, 48 * (57/256)); } catch(_){}
    }
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
  const [masivasStats, setMasivasStats] = useState({ actasCount: null, activosCount: null, isLoading: false });
  const [sinActasStats, setSinActasStats] = useState({ count: null, isLoading: false });
  const [actasConActivosStats, setActasConActivosStats] = useState({ actasCount: null, activosCount: null, isLoading: false });

  const refreshResponsables = useCallback(() => {
    dispatch(fetchResponsable());
  }, [dispatch]);

  const refreshSinActasStats = useCallback(async () => {
    setSinActasStats((p) => ({ ...p, isLoading: true }));
    try {
      const { data: actaRows, error: actaError } = await supabase
        .from("act_responsable_acta")
        .select("cirun, numeroacta, codigoambiente")
        .not("numeroacta", "is", null);
      if (actaError) throw actaError;
      const actaPairSet = new Set(
        (actaRows || [])
          .filter((r) => String(r.cirun || "").trim() !== "" && r.numeroacta != null && String(r.numeroacta).trim() !== "")
          .map((a) => `${String(a.cirun).trim()}|${String(a.codigoambiente || "").trim()}`)
      );
      // Contar activos REVISADO/INVENTARIADO que NO están en actas (ordenado por carnet+ubicación no afecta count)
      const CHUNK_FETCH = 1000;
      let totalSinActas = 0;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("act_activos")
          .select("cirun, codigoambiente")
          .eq("ultimoregistro", 1)
          .in("estadoinventario", ["REVISADO", "INVENTARIADO"])
          .range(from, from + CHUNK_FETCH - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        const sinActas = data.filter(
          (row) => !actaPairSet.has(`${String(row.cirun || "").trim()}|${String(row.codigoambiente || "").trim()}`)
        );
        totalSinActas += sinActas.length;
        if (data.length < CHUNK_FETCH) break;
        from += CHUNK_FETCH;
        if (totalSinActas > 50000) break;
        await new Promise((r) => setTimeout(r, 0));
      }
      setSinActasStats({ count: totalSinActas, isLoading: false });
    } catch (e) {
      console.warn("No se pudo calcular stats sin actas", e);
      setSinActasStats((p) => ({ ...p, isLoading: false }));
    }
  }, []);

  const refreshMasivasStats = useCallback(async () => {
    setMasivasStats((p) => ({ ...p, isLoading: true }));
    try {
      const { data: actaRows, error: actaError } = await supabase
        .from("act_responsable_acta")
        .select("cirun, numeroacta, codigoambiente")
        .not("numeroacta", "is", null);
      if (actaError) throw actaError;

      const filteredActas = (actaRows || []).filter(
        (r) => String(r.cirun || "").trim() !== "" && r.numeroacta != null && String(r.numeroacta).trim() !== ""
      );
      const actasCount = filteredActas.length;
      if (actasCount === 0) {
        setMasivasStats({ actasCount: 0, activosCount: 0, isLoading: false });
        return;
      }

      // Calcular activos que se imprimirán: act_activos por par (cirun, codigoambiente) con ultimoregistro=1 y REVISADO
      const uniqueCiruns = [...new Set(filteredActas.map((a) => String(a.cirun).trim()))];
      const actaPairSet = new Set(filteredActas.map((a) => `${String(a.cirun).trim()}|${String(a.codigoambiente || "").trim()}`));

      // Fetch paginado de activos para esos ciruns (chunk IN 500 para evitar límite)
      const CHUNK_IN = 500;
      const CHUNK_FETCH = 1000;
      let totalActivos = 0;
      for (let i = 0; i < uniqueCiruns.length; i += CHUNK_IN) {
        const cirunChunk = uniqueCiruns.slice(i, i + CHUNK_IN);
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from("act_activos")
            .select("cirun, codigoambiente")
            .in("cirun", cirunChunk)
            .eq("ultimoregistro", 1)
            .eq("estadoinventario", "REVISADO")
            .range(from, from + CHUNK_FETCH - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          // Filtrar solo pares que realmente tienen acta
          const matched = data.filter((row) =>
            actaPairSet.has(`${String(row.cirun || "").trim()}|${String(row.codigoambiente || "").trim()}`)
          );
          totalActivos += matched.length;
          if (data.length < CHUNK_FETCH) break;
          from += CHUNK_FETCH;
          if (totalActivos > 50000) break;
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      setMasivasStats({ actasCount, activosCount: totalActivos, isLoading: false });
    } catch (e) {
      console.warn("No se pudo calcular stats masivas", e);
      setMasivasStats((p) => ({ ...p, isLoading: false }));
    }
  }, []);

  const refreshActasConActivosStats = useCallback(async () => {
    setActasConActivosStats((p) => ({ ...p, isLoading: true }));
    try {
      const { data: actaRows, error: actaError } = await supabase
        .from("act_responsable_acta")
        .select("cirun, numeroacta, codigoambiente")
        .not("numeroacta", "is", null);
      if (actaError) throw actaError;
      const filteredActas = (actaRows || []).filter(
        (r) => String(r.cirun || "").trim() !== "" && r.numeroacta != null && String(r.numeroacta).trim() !== ""
      );
      const actasCount = filteredActas.length;
      if (actasCount === 0) {
        setActasConActivosStats({ actasCount: 0, activosCount: 0, isLoading: false });
        return;
      }
      const uniqueCiruns = [...new Set(filteredActas.map((a) => String(a.cirun).trim()))];
      const actaPairSet = new Set(filteredActas.map((a) => `${String(a.cirun).trim()}|${String(a.codigoambiente || "").trim()}`));
      const CHUNK_IN = 500;
      const CHUNK_FETCH = 1000;
      let totalActivos = 0;
      for (let i = 0; i < uniqueCiruns.length; i += CHUNK_IN) {
        const cirunChunk = uniqueCiruns.slice(i, i + CHUNK_IN);
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from("act_activos")
            .select("cirun, codigoambiente")
            .in("cirun", cirunChunk)
            .eq("ultimoregistro", 1)
            .eq("estadoinventario", "REVISADO")
            .range(from, from + CHUNK_FETCH - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          const matched = data.filter((row) =>
            actaPairSet.has(`${String(row.cirun || "").trim()}|${String(row.codigoambiente || "").trim()}`)
          );
          totalActivos += matched.length;
          if (data.length < CHUNK_FETCH) break;
          from += CHUNK_FETCH;
          if (totalActivos > 50000) break;
          await new Promise((r) => setTimeout(r, 0));
        }
      }
      setActasConActivosStats({ actasCount, activosCount: totalActivos, isLoading: false });
    } catch (e) {
      console.warn("No se pudo calcular stats actas con activos", e);
      setActasConActivosStats((p) => ({ ...p, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    refreshMasivasStats();
    refreshSinActasStats();
    refreshActasConActivosStats();
  }, [refreshMasivasStats, refreshSinActasStats, refreshActasConActivosStats]);

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
        const desc = sanitize(a.descripcionActivo ?? a.descripcionactivo ?? "");
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
        const desc = sanitize2(a.descripcionActivo ?? a.descripcionactivo ?? "");
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
          try { doc.addImage(LOGO_JPG_DATA_URL, "JPEG", 14, 8, 48, 48 * (57/256)); } catch(_){}
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

  const printActasMasivas = useCallback(async () => {
    setIsPrinting(true);
    setPrintingId("masivo");

    try {
      // 1. Obtener todas las actas que tienen numeroacta (relación con cirun)
      const { data: actaRows, error: actaError } = await supabase
        .from("act_responsable_acta")
        .select("cirun, numeroacta, codigoambiente")
        .not("numeroacta", "is", null)
        .order("numeroacta", { ascending: true });

      if (actaError) throw actaError;

      const filteredActas = (actaRows || []).filter(
        (r) => String(r.cirun || "").trim() !== "" && r.numeroacta != null && String(r.numeroacta).trim() !== ""
      );

      if (filteredActas.length === 0) {
        toast({
          title: "Sin actas",
          description: "No hay actas con número asignado en act_responsable_acta.",
          variant: "destructive",
        });
        return;
      }

      // 2. Resolver responsables (map cirun -> responsable)
      const uniqueCiruns = [...new Set(filteredActas.map((a) => String(a.cirun).trim()))];

      // Fetch responsables en chunks por IN (supabase limita ~1000)
      const CHUNK_IN = 500;
      const responsableMap = {};
      for (let i = 0; i < uniqueCiruns.length; i += CHUNK_IN) {
        const chunk = uniqueCiruns.slice(i, i + CHUNK_IN);
        const { data: respChunk, error: respError } = await supabase
          .from("act_responsable")
          .select("cirun, nombre1, nombre2, paterno, materno, cargo")
          .in("cirun", chunk);
        if (respError) throw respError;
        (respChunk || []).forEach((r) => {
          responsableMap[String(r.cirun).trim()] = r;
        });
      }

      // 3. Precargar catálogos una sola vez (igual que loadActaData)
      const [tipoRubros, rubros, ambData, nData, iData, cData] = await Promise.all([
        getCachedCatalog("act_tiporubro"),
        getCachedCatalog("act_rubro"),
        getCachedCatalog("act_ambiente"),
        getCachedCatalog("act_nivel"),
        getCachedCatalog("act_inmueble"),
        getCachedCatalog("act_ciudad")
      ]);

      const rubroMap = {};
      (rubros || []).forEach((r) => rubroMap[r.codigorubroact] = r.descripcionrubroact);
      const tipoRubroMap = {};
      const descTipoRubroMap = {};
      (tipoRubros || []).forEach((tr) => {
        tipoRubroMap[tr.tiporubroact] = rubroMap[tr.codigorubroact];
        descTipoRubroMap[tr.tiporubroact] = tr.descripciontiporubroact;
      });

      const ambienteMap = {};
      const ambienteNivelMap = {};
      if (ambData && ambData.length) {
        ambData.forEach((a) => {
          ambienteMap[String(a.codigoambiente).trim()] = a.ambiente;
          ambienteNivelMap[String(a.codigoambiente).trim()] = a.codigonivel;
        });
      }
      const nivelMap = {};
      const nivelInmuebleMap = {};
      if (nData && nData.length) {
        nData.forEach((n) => {
          nivelMap[String(n.codigonivel).trim()] = n.nivel;
          nivelInmuebleMap[String(n.codigonivel).trim()] = n.codigoinmueble;
        });
      }
      const inmuebleMap = {};
      const inmuebleCiudadMap = {};
      if (iData && iData.length) {
        iData.forEach((i) => {
          inmuebleMap[String(i.codigoinmueble).trim()] = i.inmueble;
          inmuebleCiudadMap[String(i.codigoinmueble).trim()] = i.codigociudad;
        });
      }
      const ciudadMap = {};
      if (cData && cData.length) {
        cData.forEach((c) => ciudadMap[String(c.codigociudad).trim()] = c.descripcion);
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

      // 4. Crear documento masivo
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
      doc.setFont("helvetica");
      let generatedCount = 0;
      let skippedCount = 0;
      let firstActa = true;

      const sanitize = (s) => String(s ?? "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").replace(/\s+/g, " ").trim();

      for (const acta of filteredActas) {
        const cirun = String(acta.cirun).trim();
        const numeroActa = acta.numeroacta;
        const codigoAmbiente = String(acta.codigoambiente || "").trim();
        const responsable = responsableMap[cirun];

        if (!responsable) {
          skippedCount++;
          continue;
        }
        if (!codigoAmbiente) {
          skippedCount++;
          continue;
        }

        // Relación cirun -> act_activos por codigoambiente (misma lógica que individual)
        const { data: rawAssets, error: assetsError } = await supabase
          .from("act_activos")
          .select(ASSET_SELECT)
          .eq("cirun", cirun)
          .eq("codigoambiente", codigoAmbiente)
          .eq("ultimoregistro", 1)
          .eq("estadoinventario", "REVISADO")
          .order("codigoactivo", { ascending: true });

        if (assetsError) {
          console.warn(`Error cargando activos para ${cirun} / ${codigoAmbiente}:`, assetsError);
          skippedCount++;
          continue;
        }

        const assets = toCamelCaseArray(rawAssets || []);
        if (assets.length === 0) {
          skippedCount++;
          continue;
        }

        if (!firstActa) {
          doc.addPage();
        }
        firstActa = false;

        const { tableStartY } = await drawActaHeader(doc, { numeroActa, responsable });

        const tableData = assets.map((a) => {
          const trId = a.tipoRubroAct || a.tiporubroact;
          const rn = sanitize(tipoRubroMap[trId] || "");
          const tn = sanitize(descTipoRubroMap[trId] || "");
          const desc = sanitize(a.descripcionActivo ?? a.descripcionactivo ?? "");
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
          bodyStyles: { overflow: 'linebreak', valign: 'top' },
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
        generatedCount++;
      }

      if (generatedCount === 0) {
        toast({
          title: "Sin actas para imprimir",
          description: "Ninguna acta con número asignado tiene activos vigentes (REVISADO).",
          variant: "destructive",
        });
        return;
      }

      drawPageNumbers(doc);

      const dateStr = new Date().toISOString().slice(0, 10);
      doc.save(`Actas_Asignacion_Masivas_${dateStr}.pdf`);

      toast({
        title: "Actas masivas generadas",
        description: `Se generaron ${generatedCount} actas${skippedCount ? ` (${skippedCount} omitidas sin activos/responsable)` : ""}.`,
      });
      refreshResponsables();
      refreshMasivasStats();
    } catch (err) {
      console.error("Error al generar actas masivas:", err);
      const errorMsg = formatError(err);
      toast({
        title: "Error",
        description: `Hubo un problema al generar las actas masivas: ${errorMsg}`,
        variant: "destructive",
      });
    } finally {
      setIsPrinting(false);
      setPrintingId(null);
    }
  }, [toast, refreshResponsables, refreshMasivasStats]);

  const printActivosSinActas = useCallback(async () => {
    setIsPrinting(true);
    setPrintingId("sinActas");
    try {
      // 1. Obtener pares con acta
      const { data: actaRows, error: actaError } = await supabase
        .from("act_responsable_acta")
        .select("cirun, numeroacta, codigoambiente")
        .not("numeroacta", "is", null);
      if (actaError) throw actaError;
      const actaPairSet = new Set(
        (actaRows || [])
          .filter((r) => String(r.cirun || "").trim() !== "" && r.numeroacta != null && String(r.numeroacta).trim() !== "")
          .map((a) => `${String(a.cirun).trim()}|${String(a.codigoambiente || "").trim()}`)
      );

      // 2. Precargar catálogos
      const [tipoRubros, rubros, ambData, nData, iData, cData] = await Promise.all([
        getCachedCatalog("act_tiporubro"),
        getCachedCatalog("act_rubro"),
        getCachedCatalog("act_ambiente"),
        getCachedCatalog("act_nivel"),
        getCachedCatalog("act_inmueble"),
        getCachedCatalog("act_ciudad"),
      ]);
      const rubroMap = {};
      (rubros || []).forEach((r) => rubroMap[r.codigorubroact] = r.descripcionrubroact);
      const tipoRubroMap = {};
      const descTipoRubroMap = {};
      (tipoRubros || []).forEach((tr) => {
        tipoRubroMap[tr.tiporubroact] = rubroMap[tr.codigorubroact];
        descTipoRubroMap[tr.tiporubroact] = tr.descripciontiporubroact;
      });
      const ambienteMap = {};
      const ambienteNivelMap = {};
      if (ambData && ambData.length) {
        ambData.forEach((a) => {
          ambienteMap[String(a.codigoambiente).trim()] = a.ambiente;
          ambienteNivelMap[String(a.codigoambiente).trim()] = a.codigonivel;
        });
      }
      const nivelMap = {};
      const nivelInmuebleMap = {};
      if (nData && nData.length) {
        nData.forEach((n) => {
          nivelMap[String(n.codigonivel).trim()] = n.nivel;
          nivelInmuebleMap[String(n.codigonivel).trim()] = n.codigoinmueble;
        });
      }
      const inmuebleMap = {};
      const inmuebleCiudadMap = {};
      if (iData && iData.length) {
        iData.forEach((i) => {
          inmuebleMap[String(i.codigoinmueble).trim()] = i.inmueble;
          inmuebleCiudadMap[String(i.codigoinmueble).trim()] = i.codigociudad;
        });
      }
      const ciudadMap = {};
      if (cData && cData.length) {
        cData.forEach((c) => ciudadMap[String(c.codigociudad).trim()] = c.descripcion);
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

      // 3. Fetch activos INVENTARIADO/REVISADO y filtrar sin actas
      const CHUNK_FETCH = 1000;
      let allSinActasRaw = [];
      let from = 0;
      toast({ title: "Generando reporte", description: "Cargando activos sin actas (REVISADO/INVENTARIADO)..." });
      while (true) {
        const { data, error } = await supabase
          .from("act_activos")
          .select(`${ASSET_SELECT}, cirun`)
          .eq("ultimoregistro", 1)
          .in("estadoinventario", ["REVISADO", "INVENTARIADO"])
          .range(from, from + CHUNK_FETCH - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        const filtered = data.filter(
          (row) => !actaPairSet.has(`${String(row.cirun || "").trim()}|${String(row.codigoambiente || "").trim()}`)
        );
        allSinActasRaw = allSinActasRaw.concat(filtered);
        if (data.length < CHUNK_FETCH) break;
        from += CHUNK_FETCH;
        if (allSinActasRaw.length > 30000) break;
        await new Promise((r) => setTimeout(r, 0));
      }

      if (allSinActasRaw.length === 0) {
        toast({
          title: "Sin datos",
          description: "No hay activos sin actas en estado REVISADO/INVENTARIADO.",
          variant: "destructive",
        });
        return;
      }

      const assets = toCamelCaseArray(allSinActasRaw);
      // Enriquecer para orden carnet + ubicación
      const enriched = assets.map((a) => {
        const trId = a.tipoRubroAct || a.tiporubroact;
        const rn = tipoRubroMap[trId] || "";
        const tn = descTipoRubroMap[trId] || "";
        const ubicacion = resolveUbicacion(a.codigoAmbiente || a.codigoambiente);
        const ci = String(a.cirun || "").trim() || "—";
        return {
          a,
          rn,
          tn,
          ubicacion,
          ci,
          codigoFormateado: `OJ-02-${String(a.codigoActivo || a.codigoactivo || "").trim()}`,
          descripcion: String(a.descripcionActivo ?? a.descripcionactivo ?? "").trim() || "—",
          observaciones: String(a.observaciones || "").trim() || "",
          estado: String(a.estadoConservacion || a.estadoconservacion || "REGULAR").toUpperCase() || "REGULAR",
        };
      });

      enriched.sort((x, y) => {
        const ciCmp = String(x.ci).localeCompare(String(y.ci), "es", { numeric: true });
        if (ciCmp !== 0) return ciCmp;
        const ubCmp = String(x.ubicacion || "").toLowerCase().localeCompare(String(y.ubicacion || "").toLowerCase(), "es");
        if (ubCmp !== 0) return ubCmp;
        return String(x.codigoFormateado).localeCompare(String(y.codigoFormateado));
      });

      // 4. Generar PDF
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
      const pageWidth = doc.internal.pageSize.getWidth();
      try { doc.addImage(LOGO_JPG_DATA_URL, "JPEG", 14, 8, 48, 48 * (57 / 256)); } catch (_) {}
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("ACTIVOS SIN ACTAS - REVISADO / INVENTARIADO", pageWidth / 2, 20, { align: "center" });
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const fechaStr = new Date().toLocaleDateString("es-BO", { day: "2-digit", month: "long", year: "numeric" }).toUpperCase();
      doc.text(`FECHA: ${fechaStr}  |  TOTAL: ${enriched.length} ACTIVOS SIN ACTA`, pageWidth / 2, 26, { align: "center" });
      doc.setFontSize(7);
      doc.text("Ordenado por Carnet (CI) y Ubicación (Ciudad / Inmueble / Nivel / Ambiente) - Sin registro en act_responsable_acta", pageWidth / 2, 30, { align: "center" });

      const sanitize = (s) => String(s ?? "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").replace(/\s+/g, " ").trim();
      const tableData = enriched.map((e) => [
        sanitize(e.codigoFormateado),
        sanitize(e.rn),
        sanitize(e.tn),
        sanitize(e.descripcion),
        sanitize(e.ubicacion),
        sanitize(e.ci),
        sanitize(e.estado),
      ]);

      autoTable(doc, {
        startY: 36,
        head: [["CÓDIGO", "RUBRO", "TIPO", "DESCRIPCIÓN", "UBICACIÓN", "CI RESPONSABLE", "ESTADO"]],
        body: tableData,
        theme: "plain",
        styles: { font: "helvetica", fontSize: 6.5, cellPadding: 1.2, overflow: "linebreak", lineColor: [0, 0, 0], lineWidth: 0.1, valign: "top" },
        headStyles: { fontStyle: "bold", fillColor: [240, 240, 240], textColor: [0, 0, 0], halign: "center", valign: "middle", fontSize: 6.8 },
        columnStyles: {
          0: { cellWidth: 22, halign: "center" },
          1: { cellWidth: 26 },
          2: { cellWidth: 22 },
          3: { cellWidth: 68 },
          4: { cellWidth: 60 },
          5: { cellWidth: 22, halign: "center" },
          6: { cellWidth: 18, halign: "center" },
        },
        margin: { top: 36, left: 14, right: 14 },
        didParseCell: (hookData) => {
          if ([1, 2, 3, 4].includes(hookData.column.index)) {
            const colWidth = hookData.column.width || hookData.cell.width || 0;
            const maxWidth = colWidth > 6 ? colWidth - 3 : 0;
            const raw = hookData.cell.text.join(" ");
            if (raw && maxWidth > 6) hookData.cell.text = doc.splitTextToSize(raw, maxWidth);
          }
        },
      });

      let finalY = doc.lastAutoTable.finalY + 6;
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(`Cantidad sin actas: ${enriched.length}`, 14, finalY);
      finalY += 4;
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      const disclaimer = "Reporte de activos con estado INVENTARIADO/REVISADO (ultimoregistro=1) cuyo par (cirun, codigoambiente) NO existe en act_responsable_acta. Ordenado por CI y ubicación jerárquica.";
      const discLines = doc.splitTextToSize(disclaimer, pageWidth - 28);
      doc.text(discLines, 14, finalY);
      doc.setTextColor(0);

      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        if (i > 1) { try { doc.addImage(LOGO_JPG_DATA_URL, "JPEG", 14, 8, 48, 48 * (57 / 256)); } catch (_) {} }
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 6, { align: "center" });
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      doc.save(`Activos_Sin_Actas_${dateStr}.pdf`);
      toast({ title: "Reporte generado", description: `Se exportaron ${enriched.length} activos sin actas ordenados por carnet y ubicación.` });
      refreshSinActasStats();
    } catch (err) {
      console.error("Error generando reporte sin actas:", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsPrinting(false);
      setPrintingId(null);
    }
  }, [toast, refreshSinActasStats]);

  const printReporteActasConActivos = useCallback(async () => {
    setIsPrinting(true);
    setPrintingId("actasConActivos");
    try {
      const { data: actaRows, error: actaError } = await supabase
        .from("act_responsable_acta")
        .select("cirun, numeroacta, codigoambiente")
        .not("numeroacta", "is", null)
        .order("numeroacta", { ascending: true });
      if (actaError) throw actaError;
      const filteredActas = (actaRows || []).filter(
        (r) => String(r.cirun || "").trim() !== "" && r.numeroacta != null && String(r.numeroacta).trim() !== ""
      );
      if (filteredActas.length === 0) {
        toast({ title: "Sin actas", description: "No hay actas con número asignado.", variant: "destructive" });
        return;
      }

      // Responsables map
      const uniqueCiruns = [...new Set(filteredActas.map((a) => String(a.cirun).trim()))];
      const CHUNK_IN = 500;
      const responsableMap = {};
      for (let i = 0; i < uniqueCiruns.length; i += CHUNK_IN) {
        const chunk = uniqueCiruns.slice(i, i + CHUNK_IN);
        const { data: respChunk, error: respError } = await supabase
          .from("act_responsable")
          .select("cirun, nombre1, nombre2, paterno, materno, cargo")
          .in("cirun", chunk);
        if (respError) throw respError;
        (respChunk || []).forEach((r) => {
          responsableMap[String(r.cirun).trim()] = r;
        });
      }

      // Catálogos para ubicación y rubro
      const [tipoRubros, rubros, ambData, nData, iData, cData] = await Promise.all([
        getCachedCatalog("act_tiporubro"),
        getCachedCatalog("act_rubro"),
        getCachedCatalog("act_ambiente"),
        getCachedCatalog("act_nivel"),
        getCachedCatalog("act_inmueble"),
        getCachedCatalog("act_ciudad"),
      ]);
      const rubroMap = {};
      (rubros || []).forEach((r) => rubroMap[r.codigorubroact] = r.descripcionrubroact);
      const tipoRubroMap = {};
      (tipoRubros || []).forEach((tr) => {
        tipoRubroMap[tr.tiporubroact] = rubroMap[tr.codigorubroact];
      });
      const ambienteMap = {};
      const ambienteNivelMap = {};
      if (ambData && ambData.length) {
        ambData.forEach((a) => {
          ambienteMap[String(a.codigoambiente).trim()] = a.ambiente;
          ambienteNivelMap[String(a.codigoambiente).trim()] = a.codigonivel;
        });
      }
      const nivelMap = {};
      const nivelInmuebleMap = {};
      if (nData && nData.length) {
        nData.forEach((n) => {
          nivelMap[String(n.codigonivel).trim()] = n.nivel;
          nivelInmuebleMap[String(n.codigonivel).trim()] = n.codigoinmueble;
        });
      }
      const inmuebleMap = {};
      const inmuebleCiudadMap = {};
      if (iData && iData.length) {
        iData.forEach((i) => {
          inmuebleMap[String(i.codigoinmueble).trim()] = i.inmueble;
          inmuebleCiudadMap[String(i.codigoinmueble).trim()] = i.codigociudad;
        });
      }
      const ciudadMap = {};
      if (cData && cData.length) {
        cData.forEach((c) => ciudadMap[String(c.codigociudad).trim()] = c.descripcion);
      }
      const resolveUbicacion = (codigoAmbiente) => {
        const ca = String(codigoAmbiente || "").trim();
        if (!ca) return "—";
        const ambiente = (ambienteMap[ca] || "").trim();
        const codNivel = String(ambienteNivelMap[ca] || "").trim();
        const nivel = codNivel ? (nivelMap[codNivel] || "").trim() : "";
        const codInmueble = codNivel ? String(nivelInmuebleMap[codNivel] || "").trim() : "";
        const inmueble = codInmueble ? (inmuebleMap[codInmueble] || "").trim() : "";
        const codCiudad = codInmueble ? String(inmuebleCiudadMap[codInmueble] || "").trim() : "";
        const ciudad = codCiudad ? (ciudadMap[codCiudad] || "").trim() : "";
        return [ciudad, inmueble, nivel, ambiente].filter(Boolean).join(", ") || "—";
      };

      // Fetch activos agrupados por acta (par cirun+ambiente) con conteo
      const normCode = (v) => {
        const s = String(v ?? "").trim();
        if (s === "") return "";
        const n = Number(s);
        return Number.isNaN(n) ? s : String(n);
      };
      const actaPairSet = new Set(filteredActas.map((a) => `${String(a.cirun).trim()}|${normCode(a.codigoambiente)}`));
      const activosPorActa = new Map(); // key -> lista
      filteredActas.forEach((a) => {
        const key = `${String(a.cirun).trim()}|${normCode(a.codigoambiente)}`;
        activosPorActa.set(key, []);
      });

      // Fetch paginado
      let from = 0;
      const CHUNK_FETCH = 1000;
      // Usamos uniqueCiruns chunk para no exceder límite IN
      const allCiruns = uniqueCiruns;
      // Para simplificar, fetch por chunks de ciruns
      for (let i = 0; i < allCiruns.length; i += CHUNK_IN) {
        const cirunChunk = allCiruns.slice(i, i + CHUNK_IN);
        let innerFrom = 0;
        while (true) {
          const { data, error } = await supabase
            .from("act_activos")
            .select(`${ASSET_SELECT}, cirun`)
            .in("cirun", cirunChunk)
            .eq("ultimoregistro", 1)
            .eq("estadoinventario", "REVISADO")
            .range(innerFrom, innerFrom + CHUNK_FETCH - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          const batch = toCamelCaseArray(data);
          batch.forEach((row) => {
            // cirun viene ahora en el select, asegurar fallback por si toCamelCase lo mapea a cirun
            const cirunVal = row.cirun || row.cirun || "";
            const key = `${String(cirunVal).trim()}|${normCode(row.codigoAmbiente || row.codigoambiente)}`;
            if (activosPorActa.has(key)) {
              activosPorActa.get(key).push(row);
            }
          });
          if (data.length < CHUNK_FETCH) break;
          innerFrom += CHUNK_FETCH;
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      // Construir filas enriquecidas ordenadas por numeroActa asc
      const sanitize = (s) => String(s ?? "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").replace(/\s+/g, " ").trim();
      const enriched = filteredActas
        .map((acta) => {
          const key = `${String(acta.cirun).trim()}|${normCode(acta.codigoambiente)}`;
          const responsable = responsableMap[String(acta.cirun).trim()] || {};
          const fullName = `${responsable.nombre1 || ""} ${responsable.nombre2 || ""} ${responsable.paterno || ""} ${responsable.materno || ""}`.replace(/\s+/g, " ").trim() || "—";
          const ubicacion = resolveUbicacion(acta.codigoambiente);
          const activos = activosPorActa.get(key) || [];
          return {
            numeroActa: acta.numeroacta,
            numeroActaNum: Number(String(acta.numeroacta).trim()) || Infinity,
            cirun: String(acta.cirun).trim(),
            responsable: fullName,
            cargo: String(responsable.cargo || "—").trim() || "—",
            ubicacion,
            cantidad: activos.length,
            activos,
            codigoambiente: String(acta.codigoambiente || "").trim(),
          };
        })
        .sort((a, b) => {
          if (a.numeroActaNum !== b.numeroActaNum) return a.numeroActaNum - b.numeroActaNum;
          return String(a.numeroActa).localeCompare(String(b.numeroActa));
        });

      const totalActivos = enriched.reduce((sum, r) => sum + r.cantidad, 0);

      // Generar PDF
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      try { doc.addImage(LOGO_JPG_DATA_URL, "JPEG", 14, 8, 48, 48 * (57 / 256)); } catch (_) {}
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("REPORTE DE ACTAS CON ACTIVOS", pageWidth / 2, 20, { align: "center" });
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const fechaStr = new Date().toLocaleDateString("es-BO", { day: "2-digit", month: "long", year: "numeric" }).toUpperCase();
      doc.text(`FECHA: ${fechaStr}  |  ACTAS: ${enriched.length}  |  ACTIVOS: ${totalActivos} (ultimoregistro=1, REVISADO)`, pageWidth / 2, 26, { align: "center" });
      doc.setFontSize(7);
      doc.text("Ordenado por Número de Acta ascendente - Cada acta agrupa activos por (cirun + codigoambiente)", pageWidth / 2, 31, { align: "center" });

      // Tabla resumen por acta
      const resumenData = enriched.map((r, idx) => [
        String(idx + 1),
        sanitize(String(r.numeroActa)),
        sanitize(r.cirun),
        sanitize(r.responsable),
        sanitize(r.cargo),
        sanitize(r.ubicacion),
        String(r.cantidad),
      ]);

      autoTable(doc, {
        startY: 36,
        head: [["#", "N° ACTA", "CI", "RESPONSABLE", "CARGO", "UBICACIÓN", "CANT. ACTIVOS"]],
        body: resumenData,
        theme: "plain",
        styles: { font: "helvetica", fontSize: 7, cellPadding: 1.5, overflow: "linebreak", lineColor: [0, 0, 0], lineWidth: 0.1, valign: "top" },
        headStyles: { fontStyle: "bold", fillColor: [240, 240, 240], textColor: [0, 0, 0], halign: "center", valign: "middle", fontSize: 7.5 },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 22, halign: "center" },
          2: { cellWidth: 22, halign: "center" },
          3: { cellWidth: 62 },
          4: { cellWidth: 46 },
          5: { cellWidth: 72 },
          6: { cellWidth: 22, halign: "center", fontStyle: "bold" },
        },
        margin: { left: 14, right: 14 },
        didParseCell: (data) => {
          if (data.column.index === 6 && data.cell.raw) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.halign = "center";
          }
        },
      });

      let finalY = doc.lastAutoTable.finalY + 6;

      // Detalle por acta: tabla de activos para cada acta con al menos 1 activo
      // Para no hacer PDF gigante, incluimos detalle solo si cantidad <= 50 por acta, sino solo resumen
      const MAX_DETALLE_POR_ACTA = 50;
      for (let idx = 0; idx < enriched.length; idx++) {
        const r = enriched[idx];
        if (r.cantidad === 0) continue;
        if (r.cantidad > MAX_DETALLE_POR_ACTA) continue; // omitir detalle muy grande, solo resumen

        const neededHeader = 14;
        if (finalY + neededHeader > pageHeight - 20) {
          doc.addPage();
          try { doc.addImage(LOGO_JPG_DATA_URL, "JPEG", 14, 8, 48, 48 * (57 / 256)); } catch (_) {}
          finalY = 32;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(0);
        doc.text(`Acta N° ${r.numeroActa} — ${r.responsable} (CI ${r.cirun}) — ${r.ubicacion} — ${r.cantidad} activos`, 14, finalY);
        finalY += 4;
        doc.setDrawColor(200);
        doc.line(14, finalY, pageWidth - 14, finalY);
        finalY += 2;

        const activos = r.activos;
        const detalleData = activos.map((a) => {
          const trId = a.tipoRubroAct || a.tiporubroact;
          const codigo = `OJ-02-${sanitize(a.codigoActivo || a.codigoactivo || "")}`;
          const desc = sanitize(a.descripcionActivo ?? a.descripcionactivo ?? "");
          const rn = sanitize(tipoRubroMap[trId] || "");
          const estado = sanitize(a.estadoConservacion || a.estadoconservacion || "REGULAR").toUpperCase();
          return [codigo, rn, desc, estado];
        });

        autoTable(doc, {
          startY: finalY,
          head: [["CÓDIGO", "RUBRO", "DESCRIPCIÓN", "ESTADO"]],
          body: detalleData,
          theme: "plain",
          styles: { font: "helvetica", fontSize: 6, cellPadding: 1.1, overflow: "linebreak", lineColor: [0, 0, 0], lineWidth: 0.08, valign: "top" },
          headStyles: { fontStyle: "bold", fillColor: [245, 245, 245], textColor: [0, 0, 0], halign: "center", fontSize: 6.5 },
          columnStyles: {
            0: { cellWidth: 28, halign: "center" },
            1: { cellWidth: 40 },
            2: { cellWidth: 150 },
            3: { cellWidth: 22, halign: "center" },
          },
          margin: { left: 14, right: 14 },
        });
        finalY = doc.lastAutoTable.finalY + 6;
        if (idx < enriched.length - 1) {
          await new Promise((r2) => setTimeout(r2, 0));
        }
      }

      // Pie con TOTAL final destacado
      if (finalY + 18 > pageHeight - 12) {
        doc.addPage();
        finalY = 20;
      }
      // Recuadro total final
      doc.setFillColor(0, 0, 0);
      doc.rect(14, finalY, pageWidth - 28, 10, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`TOTAL GENERAL  —  ${enriched.length} ACTAS  |  ${totalActivos} ACTIVOS`, pageWidth / 2, finalY + 6.5, { align: "center" });
      finalY += 14;
      doc.setTextColor(0);
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      const disclaimer = `Reporte generado automáticamente. Incluye ${enriched.length} actas con ${totalActivos} activos (ultimoregistro=1, REVISADO). Detalle por acta limitado a ${MAX_DETALLE_POR_ACTA} activos por acta para legibilidad. Cantidad por acta visible en columna CANT. ACTIVOS.`;
      const discLines = doc.splitTextToSize(disclaimer, pageWidth - 28);
      doc.text(discLines, 14, finalY);

      // Numeración
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        if (i > 1) { try { doc.addImage(LOGO_JPG_DATA_URL, "JPEG", 14, 8, 48, 48 * (57 / 256)); } catch (_) {} }
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 6, { align: "center" });
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      doc.save(`Reporte_Actas_Con_Activos_${dateStr}.pdf`);
      toast({ title: "Reporte generado", description: `${enriched.length} actas con ${totalActivos} activos.` });
      refreshActasConActivosStats();
    } catch (err) {
      console.error("Error generando reporte actas con activos:", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsPrinting(false);
      setPrintingId(null);
    }
  }, [toast, refreshActasConActivosStats]);

  return {
    printActaAsignacion,
    printActaListado,
    printActasMasivas,
    printActivosSinActas,
    printReporteActasConActivos,
    isPrinting,
    printingId,
    masivasStats,
    refreshMasivasStats,
    sinActasStats,
    refreshSinActasStats,
    actasConActivosStats,
    refreshActasConActivosStats,
  };
};