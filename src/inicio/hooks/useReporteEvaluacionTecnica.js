import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { fetchEvaluacionTecnicaActivos, buildEvaluacionTecnicaPDF } from "../services/evaluacionTecnicaService";

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
 * Reporte FICHA DE EVALUACION TECNICA (PDF) — PRODUCTO 4.
 * Criterio: estado=1 AND ultimoregistro=1 AND estadoconservacion
 * en (BUENO, REGULAR). Sin filtro pararevaluo y sin leyenda.
 * Ficha por activo como el reporte Lotes del revalúo, sin cotizaciones,
 * sin respaldos, sin factores, sin promedio ni precio. Con fotografía.
 * Orden: codigoactivo ASC.
 */
export const useReporteEvaluacionTecnica = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    try {
      toast({ title: "Generando Evaluación Técnica", description: "Cargando activos (estado=1, BUENO/REGULAR)..." });
      const rows = await fetchEvaluacionTecnicaActivos();
      if (rows.length === 0) {
        toast({ title: "Sin datos", description: "No hay activos con ese criterio.", variant: "destructive" });
        return;
      }
      toast({ title: "Generando PDF", description: `Construyendo fichas de ${rows.length} activos...` });
      await buildEvaluacionTecnicaPDF(rows);
      toast({ title: "Reporte generado", description: `Se exportaron ${rows.length} fichas de evaluación técnica.` });
    } catch (err) {
      console.error("Error generando Evaluación Técnica", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
