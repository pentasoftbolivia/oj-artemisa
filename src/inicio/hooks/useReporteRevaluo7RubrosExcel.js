import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
import {
  FECHA_REVALUO,
  REVALUO_7_RUBROS_HEADERS,
  loadRevaluo7Rubros,
} from "../services/revaluo7RubrosService";

const formatError = (err) => {
  if (!err) return "Error desconocido";
  const code = err?.code ? `[${err.code}] ` : "";
  const message = err?.message || err?.details || err?.hint || err?.error_description;
  if (message) return `${code}${message}`;
  return `${code}${String(err)}`;
};

const sanitizeSheetName = (name) =>
  String(name ?? "")
    .replace(/[:\\/?*[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31) || "RUBRO";

const uniqueSheetName = (base, used) => {
  const clean = sanitizeSheetName(base);
  let name = clean;
  let counter = 2;
  while (used.has(name.toLowerCase())) {
    const suffix = ` (${counter})`;
    name = `${clean.slice(0, 31 - suffix.length).trim()}${suffix}`;
    counter += 1;
  }
  used.add(name.toLowerCase());
  return name;
};

/**
 * REPORTE REVALUO 7 RUBROS (Excel).
 * Genera un libro con 7 pestañas (una por rubro). En cada pestaña:
 * N°, Código Activo, Descripción, Propuesta de descripción del Bien,
 * Rubro Contable, Valor en Libros, Nuevo Valor, Nueva vida Útil,
 * Estado del Bien, Observación y/o Recomendación, Fecha de Revalúo.
 */
export const useReporteRevaluo7RubrosExcel = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    try {
      toast({ title: "Generando Revaluo 7 Rubros (Excel)", description: "Cargando activos de revalúo..." });

      const { grupos, total, sinClasificar } = await loadRevaluo7Rubros();

      if (total === 0) {
        toast({
          title: "Sin datos",
          description: "No hay activos de revalúo en los 7 rubros para generar el reporte.",
          variant: "destructive",
        });
        return;
      }

      const omitidos = Object.values(sinClasificar ?? {}).reduce((sum, n) => sum + Number(n || 0), 0);
      if (omitidos > 0) {
        toast({
          title: "Activos sin clasificar",
          description: `${omitidos} activos del universo TODO REVALUO no coinciden con los 7 rubros y no se incluyeron.`,
          variant: "destructive",
        });
      }

      toast({ title: "Generando Excel", description: `Construyendo libro con ${total} activos en 7 pestañas...` });

      const wb = XLSX.utils.book_new();
      const usedNames = new Set();

      grupos.forEach((grupo) => {
        const dataRows = grupo.rows.length;

        const data = grupo.rows.map((row) => [
          row.n,
          row.codigoActivo != null ? `OJ-02-${row.codigoActivo}` : "—",
          row.descripcion || "—",
          row.propuestaDescripcion || "",
          row.rubroContable || "—",
          row.valorEnLibros ?? "",
          row.nuevoValor ?? "",
          row.nuevaVidaUtil ?? "",
          row.estadoBien || "—",
          row.observacion || "—",
          row.fechaRevaluo,
        ]);

        if (dataRows > 0) {
          data.push([
            "",
            "TOTAL",
            "",
            "",
            "",
            grupo.rows.reduce((sum, row) => sum + (Number(row.valorEnLibros) || 0), 0),
            grupo.rows.reduce((sum, row) => sum + (Number(row.nuevoValor) || 0), 0),
            "",
            "",
            "",
            "",
          ]);
        }

        const ws = XLSX.utils.aoa_to_sheet([REVALUO_7_RUBROS_HEADERS, ...data]);

        ws["!cols"] = [
          { wch: 6 },
          { wch: 16 },
          { wch: 55 },
          { wch: 40 },
          { wch: 32 },
          { wch: 18 },
          { wch: 16 },
          { wch: 12 },
          { wch: 14 },
          { wch: 45 },
          { wch: 16 },
        ];

        if (dataRows > 0) {
          ws["!freeze"] = "A2";
          ws["!autofilter"] = { ref: `A1:K${dataRows + 1}` };
        }

        for (let r = 1; r <= dataRows + 1; r++) {
          for (const c of [5, 6]) {
            const cell = ws[XLSX.utils.encode_cell({ r, c })];
            if (cell && cell.t === "n") cell.z = "#,##0.00";
          }
        }

        ws["!pageSetup"] = {
          orientation: "landscape",
          paperSize: 1,
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
        };
        ws["!margins"] = { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };

        XLSX.utils.book_append_sheet(wb, ws, uniqueSheetName(grupo.sheetName, usedNames));
      });

      const dateStr = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `Revaluo_7_Rubros_${dateStr}.xlsx`);

      toast({ title: "Reporte generado", description: `Se exportaron ${total} activos en 7 pestañas.` });
    } catch (err) {
      console.error("Error generando Revaluo 7 Rubros (Excel)", err);
      toast({
        title: "Error",
        description: `No se pudo generar el reporte: ${formatError(err)}`,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
