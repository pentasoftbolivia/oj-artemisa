import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { getCachedCatalog } from "@/lib/catalogCache";
import { toCamelCaseArray } from "@/lib/mapFields";
import { useToast } from "@/hooks/use-toast";
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

const clean = (v) => String(v ?? "").replace(/\s+/g, " ").trim() || "—";

const HEADERS = [
  "N°", "Código Activo", "Rubro", "Tipo Rubro", "Descripción", "Ciudad", "Inmueble", "Nivel", "Ambiente",
  "Observaciones", "Serie", "Marca/Material", "Estado Conservación", "Modelo",
  "N° Motor", "N° Chasis/Serial", "Placa", "Capacidad", "Medidas",
  "Color", "Divisiones", "RAM", "Procesador", "Disco Duro", "Estado Inventario",
];

/**
 * Genera el reporte ACTIVOS PARA REVALUO en Excel.
 * Base exacta: ultimoregistro=1 AND pararevaluo=true
 * AND estadoinventario IN ('INVENTARIADO','REVISADO','EN PROCESO')
 * ORDER BY codigoactivo ASC.
 * Hojas: "Resumen" (totales), "ConEstado" (detalle),
 * "Faltantes" (siempre vacía con este filtro; se mantiene la hoja).
 */
export const useReporteParaRevaluoExcel = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    try {
      toast({ title: "Generando Activos para Revalúo (Excel)", description: "Cargando catálogos..." });

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

      const rowOf = (a, n) => {
        const tipoDesc = tipoRubroDescMap[a.tipoRubroAct] ?? tipoRubroDescMap[String(a.tipoRubroAct)] ?? "—";
        const rubroDesc = rubroFromTipo[a.tipoRubroAct] ?? rubroFromTipo[String(a.tipoRubroAct)] ?? "—";
        const ambCode = String(a.codigoAmbiente ?? "").trim();
        const parts = ubicacionPartsMap[ambCode];
        const capacidad = a.capacidadcargatraccion ?? a.capacidadCargatraccion ?? a.capacidaddimension ?? "—";
        return [
          n,
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
          String(a.estadoinventario ?? a.estadoInventario ?? "").trim() || "—",
        ];
      };

      toast({ title: "Generando Excel", description: `Construyendo reporte con ${allActivos.length} activos...` });

      const dateStr = new Date().toISOString().slice(0, 10);
      const resumenSheet = [
        ["ACTIVOS PARA REVALUO - RESUMEN DE TOTALES - ÓRGANO JUDICIAL"],
        [`Total activos con pararevaluo=true: ${allActivos.length}`],
        [`Fecha: ${dateStr}`],
        [],
        ["#", "Concepto", "Total"],
        [1, "Total activos para revalúo (pararevaluo=true)", allActivos.length],
        [2, "Con dato en estadoinventario", conEstado.length],
        [3, "Faltantes (estadoinventario NULL/vacío)", sinEstado.length],
      ];

      let n = 0;
      const conRows = conEstado.map((a) => { n += 1; return rowOf(a, n); });
      n = 0;
      const sinRows = sinEstado.map((a) => { n += 1; return rowOf(a, n); });

      const conSheet = [
        ["ACTIVOS PARA REVALUO - CON DATO EN ESTADOINVENTARIO - ÓRGANO JUDICIAL"],
        [`Total: ${conEstado.length} (pararevaluo=true, estadoinventario con dato)`],
        [`Fecha: ${dateStr}`],
        [],
        HEADERS,
        ...conRows,
      ];
      const sinSheet = [
        ["ACTIVOS PARA REVALUO - FALTANTES (SIN DATO EN ESTADOINVENTARIO) - ÓRGANO JUDICIAL"],
        [`Total: ${sinEstado.length} (pararevaluo=true, estadoinventario NULL/vacío)`],
        [`Fecha: ${dateStr}`],
        [],
        HEADERS,
        ...sinRows,
      ];

      const wb = XLSX.utils.book_new();
      const wsResumen = XLSX.utils.aoa_to_sheet(resumenSheet);
      wsResumen["!cols"] = [{ wch: 6 }, { wch: 52 }, { wch: 16 }];
      const wsCon = XLSX.utils.aoa_to_sheet(conSheet);
      const wsSin = XLSX.utils.aoa_to_sheet(sinSheet);
      const detailCols = [
        { wch: 7 }, { wch: 16 }, { wch: 28 }, { wch: 28 }, { wch: 50 },
        { wch: 22 }, { wch: 28 }, { wch: 18 }, { wch: 28 },
        { wch: 30 }, { wch: 16 }, { wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 16 },
        { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 18 },
        { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 16 },
      ];
      wsCon["!cols"] = detailCols;
      wsSin["!cols"] = detailCols;
      XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");
      XLSX.utils.book_append_sheet(wb, wsCon, "ConEstado");
      XLSX.utils.book_append_sheet(wb, wsSin, "Faltantes");
      XLSX.writeFile(wb, `Activos_Para_Revaluo_${dateStr}.xlsx`);

      toast({ title: "Reporte generado", description: `Se exportaron ${allActivos.length} activos (${conEstado.length} con estado, ${sinEstado.length} faltantes).` });
    } catch (err) {
      console.error("Error generando Activos para Revalúo (Excel)", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
