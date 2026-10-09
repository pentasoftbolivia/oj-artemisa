import { useState, useCallback } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
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

const LOGO_W = 48;
const LOGO_H = LOGO_W * (57 / 256);
const addLogo = (doc) => {
  try {
    doc.addImage(LOGO_JPG_DATA_URL, "JPEG", 14, 8, LOGO_W, LOGO_H);
  } catch { }
};

const clean = (v) => String(v ?? "").replace(/\s+/g, " ").trim() || "—";

/**
 * Reporte ACTIVOS PARA REVALUO (PDF).
 * Base exacta: ultimoregistro=1 AND pararevaluo=true
 * AND estadoinventario IN ('INVENTARIADO','REVISADO','EN PROCESO')
 * ORDER BY codigoactivo ASC.
 * - Resumen de totales
 * - Detalle CON dato en estadoinventario
 * - Detalle FALTANTES (siempre 0 con este filtro; se mantiene la sección)
 * Columnas: código, rubro, tipo rubro, descripción, ubicación,
 * observaciones, serie, marcamaterial, estadoconservacion, modelo,
 * numeromotor, numerochasisserial, placa, capacidad, medidas, color,
 * divisiones, ram, procesador, discoduro.
 */
export const useReporteParaRevaluo = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    try {
      toast({ title: "Generando Activos para Revalúo", description: "Cargando catálogos..." });

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
      const tipoRubroDescMap = {};
      const rubroFromTipo = {};
      (tipoRubros || []).forEach((t) => {
        tipoRubroDescMap[t.tiporubroact] = t.descripciontiporubroact;
        tipoRubroDescMap[String(t.tiporubroact)] = t.descripciontiporubroact;
        rubroFromTipo[t.tiporubroact] = rubroDescMap[t.codigorubroact];
        rubroFromTipo[String(t.tiporubroact)] = rubroDescMap[t.codigorubroact];
      });

      const nivelMap = {};
      (niveles || []).forEach((n) => { nivelMap[String(n.codigonivel ?? "").trim()] = n; });
      const inmuebleMap = {};
      (inmuebles || []).forEach((i) => { inmuebleMap[String(i.codigoinmueble ?? "").trim()] = i; });
      const ciudadMap = {};
      (ciudades || []).forEach((c) => { ciudadMap[String(c.codigociudad ?? "").trim()] = c; });
      const ubicacionJerarquiaMap = {};
      const ubicacionPartsMap = {};
      (ambientes || []).forEach((a) => {
        const code = String(a.codigoambiente ?? "").trim();
        if (!code) return;
        const nivel = nivelMap[String(a.codigonivel ?? "").trim()];
        const inmueble = nivel ? inmuebleMap[String(nivel.codigoinmueble ?? "").trim()] : null;
        const ciudad = inmueble ? ciudadMap[String(inmueble.codigociudad ?? "").trim()] : null;
        ubicacionJerarquiaMap[code] =
          [ciudad?.descripcion, inmueble?.inmueble, nivel?.nivel, a.ambiente]
            .map((s) => (s || "").trim())
            .filter(Boolean)
            .join(" / ") || String(code);
        ubicacionPartsMap[code] = {
          ciudad: String(ciudad?.descripcion ?? "").trim() || "—",
          inmueble: String(inmueble?.inmueble ?? "").trim() || "—",
          nivel: String(nivel?.nivel ?? "").trim() || "—",
          ambiente: String(a.ambiente ?? "").trim() || "—",
        };
      });
      toast({ title: "Cargando activos", description: "Obteniendo activos para revalúo (ultim=1, pararevaluo, 3 estados)..." });

      const ESTADOS_REV = ["INVENTARIADO", "REVISADO", "EN PROCESO"];
      let allActivos = [];
      let from = 0;
      const FETCH_CHUNK = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("act_activos")
          .select(ACTIVO_COLUMNS)
          .eq("ultimoregistro", 1)
          .eq("pararevaluo", true)
          .in("estadoinventario", ESTADOS_REV)
          .order("codigoactivo", { ascending: true })
          .range(from, from + FETCH_CHUNK - 1);
        if (error) throw error;
        const batch = toCamelCaseArray(data || []);
        if (batch.length === 0) break;
        allActivos = allActivos.concat(batch);
        if (batch.length < FETCH_CHUNK) break;
        from += FETCH_CHUNK;
        if (allActivos.length > 60000) break;
        await new Promise((r) => setTimeout(r, 0));
      }
      // Refuerzo en cliente (mayúsculas/espacios)
      allActivos = allActivos.filter((a) => {
        const est = String(a.estadoinventario ?? a.estadoInventario ?? "").trim().toUpperCase();
        return ESTADOS_REV.includes(est);
      });
      // Orden script: codigoactivo ASC numérico
      allActivos.sort((a, b) => Number(a.codigoActivo ?? 0) - Number(b.codigoActivo ?? 0));

      const conEstado = [];
      const sinEstado = [];
      allActivos.forEach((a) => {
        const est = String(a.estadoinventario ?? a.estadoInventario ?? "").trim();
        if (est !== "") conEstado.push(a);
        else sinEstado.push(a);
      });

      const sortByCodigo = (arr) => arr.sort((a, b) => Number(a.codigoActivo ?? 0) - Number(b.codigoActivo ?? 0));
      sortByCodigo(conEstado);
      sortByCodigo(sinEstado);

      if (allActivos.length === 0) {
        toast({ title: "Sin datos", description: "No hay activos con ese filtro (ultim=1, pararevaluo, 3 estados).", variant: "destructive" });
        return;
      }

      const rowOf = (a, idx, esFaltante = false) => {
        const tipoDesc = tipoRubroDescMap[a.tipoRubroAct] ?? tipoRubroDescMap[String(a.tipoRubroAct)] ?? "—";
        const rubroDesc = rubroFromTipo[a.tipoRubroAct] ?? rubroFromTipo[String(a.tipoRubroAct)] ?? "—";
        const ambCode = String(a.codigoAmbiente ?? "").trim();
        const parts = ubicacionPartsMap[ambCode];
        const capacidad = a.capacidadcargatraccion ?? a.capacidadCargatraccion ?? a.capacidaddimension ?? a.capacidaddimension ?? "—";
        return [
          String(idx + 1),
          a.codigoActivo != null ? `OJ-02-${a.codigoActivo}` : "—",
          clean(rubroDesc),
          clean(tipoDesc),
          clean(a.descripcionActivo ?? a.descripcionactivo),
          clean(parts?.ciudad),
          clean(parts?.inmueble),
          clean(parts?.nivel),
          clean(parts?.ambiente || ambCode),
          clean(a.observaciones),
          clean(a.serie),
          clean(a.marcamaterial ?? a.marcaMaterial),
          clean(a.estadoconservacion ?? a.estadoConservacion),
          clean(a.modelo),
          clean(a.numeromotor),
          clean(a.numerochasisserial),
          clean(a.placamatricula),
          clean(capacidad),
          clean(a.medidas),
          clean(a.color),
          clean(a.divisionescajonesbandejas),
          clean(a.ram),
          clean(a.procesador),
          clean(a.discoduro),
          esFaltante ? "FALTANTE" : "—",
        ];
      };

      toast({ title: "Generando PDF", description: `Construyendo reporte con ${allActivos.length} activos...` });

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "legal" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      addLogo(doc);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("ACTIVOS PARA REVALUO - ÓRGANO JUDICIAL", pageWidth / 2, 16, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(
        `Total: ${allActivos.length} | Con estadoinventario: ${conEstado.length} | Faltantes (sin estado): ${sinEstado.length}`,
        pageWidth / 2, 21, { align: "center" }
      );

      let currentY = 26;
      // Resumen de totales
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(16, 70, 140);
      doc.text("RESUMEN DE TOTALES (pararevaluo = true)", pageWidth / 2, currentY, { align: "center" });
      currentY += 4;
      const resumenBody = [
        ["1", "Total activos para revalúo", String(allActivos.length)],
        ["2", "Con dato en estadoinventario", String(conEstado.length)],
        ["3", "Faltantes (estadoinventario NULL/vacío)", String(sinEstado.length)],
      ];
      const resumenW = 12 + 90 + 30;
      const resumenX = (pageWidth - resumenW) / 2;
      autoTable(doc, {
        startY: currentY,
        head: [["#", "Concepto", "Total"]],
        body: resumenBody,
        theme: "striped",
        tableWidth: resumenW,
        styles: { font: "helvetica", fontSize: 7, cellPadding: 1.6, halign: "center", valign: "middle" },
        headStyles: { fillColor: [16, 70, 140], textColor: [255, 255, 255], halign: "center", fontStyle: "bold", fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 12, halign: "center" },
          1: { cellWidth: 90, halign: "left" },
          2: { cellWidth: 30, halign: "center", fontStyle: "bold" },
        },
        margin: { left: resumenX, right: resumenX, top: 26 },
      });
      currentY = doc.lastAutoTable.finalY + 8;

      const head = [[
        "N°", "Código", "Rubro", "Tipo Rubro", "Descripción", "Ciudad", "Inmueble", "Nivel", "Ambiente",
        "Observaciones", "Serie", "Marca/Mat.", "Est.Cons.", "Modelo",
        "N° Motor", "N° Chasis", "Placa", "Capacidad", "Medidas",
        "Color", "Divisiones", "RAM", "Procesador", "Disco", "ACTIVOS FALTANTES",
      ]];
      const tableOpts = (startY, body, isFaltantes = false) => ({
        startY,
        head,
        body,
        theme: "striped",
        styles: { font: "helvetica", fontSize: 4.5, cellPadding: 0.9, overflow: "linebreak", valign: "top" },
        headStyles: { fillColor: [16, 70, 140], textColor: [255, 255, 255], halign: "center", valign: "middle", fontSize: 4.5, fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 7, halign: "center" },
          1: { cellWidth: 15, halign: "center" },
          2: { cellWidth: 16, halign: "left" },
          3: { cellWidth: 16, halign: "left" },
          4: { cellWidth: 20, halign: "left" },
          5: { cellWidth: 16, halign: "left" },
          6: { cellWidth: 17, halign: "left" },
          7: { cellWidth: 15, halign: "left" },
          8: { cellWidth: 16, halign: "left" },
          9: { cellWidth: 16, halign: "left" },
          10: { cellWidth: 12, halign: "left" },
          11: { cellWidth: 14, halign: "left" },
          12: { cellWidth: 12, halign: "left" },
          13: { cellWidth: 12, halign: "left" },
          14: { cellWidth: 12, halign: "left" },
          15: { cellWidth: 14, halign: "left" },
          16: { cellWidth: 12, halign: "left" },
          17: { cellWidth: 12, halign: "left" },
          18: { cellWidth: 11, halign: "left" },
          19: { cellWidth: 11, halign: "left" },
          20: { cellWidth: 13, halign: "left" },
          21: { cellWidth: 10, halign: "left" },
          22: { cellWidth: 13, halign: "left" },
          23: { cellWidth: 12, halign: "left" },
          24: { cellWidth: 15, halign: "center", fontStyle: "bold" },
        },
        margin: { left: 6, right: 6, top: 26 },
        didParseCell: (data) => {
          // Resalta la columna ACTIVOS FALTANTES en la sección de faltantes
          if (isFaltantes && data.section === "body" && data.column.index === 24) {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = "bold";
          }
          if (isFaltantes && data.section === "head" && data.column.index === 24) {
            data.cell.styles.fillColor = [220, 38, 38];
          }
        },
      });

      const printSection = (titulo, items, esFaltantes = false) => {
        if (currentY + 14 > pageHeight - 12) {
          doc.addPage();
          currentY = 26;
        }
        doc.setFillColor(16, 70, 140);
        doc.rect(6, currentY, pageWidth - 12, 8, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text(`${titulo}  —  ${items.length} activos`, 8, currentY + 5.2);
        currentY += 10;
        const body = items.map((a, i) => rowOf(a, i, esFaltantes));
        autoTable(doc, tableOpts(currentY, body, esFaltantes));
        currentY = doc.lastAutoTable.finalY + 6;
      };

      printSection("CON DATO EN ESTADOINVENTARIO", conEstado, false);
      printSection("FALTANTES (SIN DATO EN ESTADOINVENTARIO)", sinEstado, true);

      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        if (i > 1) addLogo(doc);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80);
        doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 7, { align: "center" });
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      doc.save(`Activos_Para_Revaluo_${dateStr}.pdf`);
      toast({ title: "Reporte generado", description: `Se exportaron ${allActivos.length} activos (${conEstado.length} con estado, ${sinEstado.length} faltantes).` });
    } catch (err) {
      console.error("Error generando Activos para Revalúo", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
