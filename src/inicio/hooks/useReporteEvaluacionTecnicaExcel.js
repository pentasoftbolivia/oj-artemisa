import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { fetchEvaluacionTecnicaActivos, buildEvaluacionTecnicaExcel } from "../services/evaluacionTecnicaService";

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

/**
 * Reporte FICHA DE EVALUACION TECNICA en Excel — PRODUCTO 4.
 * Criterio: estado=1 AND ultimoregistro=1 AND estadoconservacion
 * en (BUENO, REGULAR). Sin filtro pararevaluo y sin leyenda.
 * Mismas columnas de la ficha PDF, sin cotizaciones, respaldos ni factores.
 * Orden: codigoactivo ASC.
 */
export const useReporteEvaluacionTecnicaExcel = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    try {
      toast({ title: "Generando Evaluación Técnica (Excel)", description: "Cargando activos (estado=1, BUENO/REGULAR)..." });
      const rows = await fetchEvaluacionTecnicaActivos();
      if (rows.length === 0) {
        toast({ title: "Sin datos", description: "No hay activos con ese criterio.", variant: "destructive" });
        return;
      }
      toast({ title: "Generando Excel", description: `Construyendo reporte con ${rows.length} activos...` });
      await buildEvaluacionTecnicaExcel(rows);
      toast({ title: "Reporte generado", description: `Se exportaron ${rows.length} fichas de evaluación técnica.` });
    } catch (err) {
      console.error("Error generando Evaluación Técnica (Excel)", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
