import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileDown, FileText, Loader2, Layers } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  EV_TECNICA_BLOQUE,
  fetchEvaluacionTecnicaActivos,
  fetchEvaluacionFotosMap,
  buildEvaluacionTecnicaPDF,
  buildEvaluacionTecnicaExcel,
} from "@/inicio/services/evaluacionTecnicaService";

const BLOQUE_PAGES_STORAGE_KEY = "evtec_pdf_bloques_pages_v1";

const loadBloquePages = (sig) => {
  try {
    const raw = localStorage.getItem(BLOQUE_PAGES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.sig === sig && parsed.pages && typeof parsed.pages === "object") return parsed.pages;
  } catch {
    // ignorar: sin persistencia se numera por archivo
  }
  return null;
};

const saveBloquePages = (sig, pages) => {
  try {
    localStorage.setItem(BLOQUE_PAGES_STORAGE_KEY, JSON.stringify({ sig, pages }));
  } catch {
    // ignorar
  }
};

const EvaluacionTecnicaBloquesModal = ({ open, onOpenChange }) => {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [generatingKey, setGeneratingKey] = useState(null);
  // Hojas por bloque PDF ya generado (sesión + localStorage) para continuar
  // el correlativo de hojas entre bloques del mismo proyecto.
  const pdfBloquePagesRef = useRef({ sig: "", pages: {} });

  const getBloquePages = (sig) => {
    if (pdfBloquePagesRef.current.sig !== sig) pdfBloquePagesRef.current = { sig, pages: {} };
    const stored = loadBloquePages(sig) || {};
    const pages = { ...stored, ...pdfBloquePagesRef.current.pages };
    pdfBloquePagesRef.current.pages = pages;
    return pages;
  };

  // Mapa bulk de fotos precargado en fondo (1 escaneo del bucket para todos
  // los bloques). Evita 300 list() por bloque al momento de generar.
  const fotosMapRef = useRef({ sig: "", map: new Map() });
  const bgTaskRef = useRef(0);

  // Precarga en fondo al tener filas: fotos + conteo de hojas por bloque
  // (dryRun sin descargar imágenes). No bloquea los botones.
  useEffect(() => {
    if (rows.length === 0) return;
    const taskId = ++bgTaskRef.current;
    const sig = `${rows.length}`;
    (async () => {
      try {
        const codigos = rows.map((a) => a.codigoActivo);
        const map = await fetchEvaluacionFotosMap(codigos);
        if (bgTaskRef.current !== taskId) return;
        fotosMapRef.current = { sig, map };
        // Conteo de hojas en fondo, de a 1 bloque con pausa para no congelar UI
        const paginas = getBloquePages(sig);
        const totalBloques = Math.ceil(rows.length / EV_TECNICA_BLOQUE);
        for (let j = 0; j < totalBloques; j++) {
          if (bgTaskRef.current !== taskId) return;
          if (paginas[j] != null) continue;
          const from = j * EV_TECNICA_BLOQUE + 1;
          const to = Math.min(from + EV_TECNICA_BLOQUE - 1, rows.length);
          const slice = rows.slice(from - 1, to);
          try {
            const conteo = await buildEvaluacionTecnicaPDF(slice, {
              numeroInicial: from,
              subtitulo: `Bloque del ${from} al ${to} (${slice.length})`,
              paginaInicial: 1,
              totalPaginasProyecto: null,
              dryRun: true,
              fotosMap: map,
            });
            paginas[j] = (conteo && conteo.totalPages) || 0;
          } catch {
            break;
          }
          await new Promise((r) => setTimeout(r, 0));
        }
        saveBloquePages(sig, paginas);
      } catch {
        // fondo: ignorar errores, la generación bajo demanda lo reintenta
      }
    })();
    return () => {
      bgTaskRef.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setRows([]);
    setIsLoading(true);
    (async () => {
      try {
        const list = await fetchEvaluacionTecnicaActivos();
        if (!cancelled) setRows(list || []);
      } catch (err) {
        if (!cancelled) {
          toast({ title: "Error", description: `No se pudo cargar la lista: ${err?.message || ""}`, variant: "destructive" });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, toast]);

  const bloques = [];
  for (let from = 1; from <= rows.length; from += EV_TECNICA_BLOQUE) {
    const to = Math.min(from + EV_TECNICA_BLOQUE - 1, rows.length);
    bloques.push({ from, to, slice: rows.slice(from - 1, to) });
  }

  const handleGenerate = async (key, formato, slice, from, to, bloqueIdx = null) => {
    if (slice.length === 0 || generatingKey) return;
    setGeneratingKey(key);
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const rango = `${from}-${to}`;
      if (formato === "pdf") {
        // Generación inmediata: NO se cuentan todos los bloques antes.
        // Se usa el correlativo conocido (sesión + localStorage + precarga
        // en fondo). Si faltan bloques previos, el total queda parcial y se
        // completa en fondo para los siguientes.
        const sig = `${rows.length}`;
        const paginas = getBloquePages(sig);
        let paginaInicial = 1;
        let previosCompletos = true;
        if (bloqueIdx != null) {
          for (let j = 0; j < bloqueIdx; j++) {
            if (paginas[j] == null) { previosCompletos = false; break; }
            paginaInicial += paginas[j] || 0;
          }
        }
        const todosConocidos = bloques.every((b, j) => paginas[j] != null);
        const totalPaginasProyecto = todosConocidos
          ? bloques.reduce((s, b, j) => s + (paginas[j] || 0), 0)
          : null;
        // Si el total no está completo (o faltan previos), usar numeración
        // por bloque (1 de N del bloque) para evitar "161 de 159".
        // Solo usar correlativo continuo 161 de 321 cuando todo es conocido.
        const continuoOK = todosConocidos && (bloqueIdx == null || previosCompletos);
        const paginaInicialEfectiva = continuoOK ? paginaInicial : 1;
        const totalEfectivo = continuoOK ? totalPaginasProyecto : null;
        // Mapa bulk (precargado en fondo o bajo demanda, 1 escaneo total).
        let map = fotosMapRef.current.sig === sig ? fotosMapRef.current.map : null;
        if (!map || map.size === 0) {
          const codigos = rows.map((a) => a.codigoActivo);
          map = await fetchEvaluacionFotosMap(codigos);
          fotosMapRef.current = { sig, map };
        }
        const res = await buildEvaluacionTecnicaPDF(slice, {
          numeroInicial: from,
          subtitulo: `Bloque del ${from} al ${to} (${slice.length})`,
          nombreArchivo: `Ficha_Evaluacion_Tecnica_${rango}_${dateStr}.pdf`,
          paginaInicial: paginaInicialEfectiva,
          totalPaginasProyecto: totalEfectivo,
          fotosMap: map,
        });
        if (res && res.totalPages && bloqueIdx != null) {
          paginas[bloqueIdx] = res.totalPages;
          saveBloquePages(sig, paginas);
        }
        let detalleHojas = "";
        if (res && res.totalPages) {
          detalleHojas = continuoOK
            ? ` Hojas ${paginaInicialEfectiva}–${paginaInicialEfectiva + res.totalPages - 1} de ${totalEfectivo}.`
            : ` Hojas 1–${res.totalPages} del bloque (el total continuo se completa en fondo).`;
          if (!previosCompletos && bloqueIdx != null && bloqueIdx > 0) detalleHojas += " Genere los bloques anteriores para correlativo exacto.";
        }
        toast({ title: "Reporte generado", description: `PDF del ${from} al ${to} descargado.${detalleHojas}` });
        // Completar el conteo restante en fondo sin bloquear la UI.
        if (bloqueIdx != null && !todosConocidos) {
          const taskId = bgTaskRef.current;
          (async () => {
            const pag = getBloquePages(sig);
            for (let j = 0; j < bloques.length; j++) {
              if (pag[j] != null) continue;
              const b = bloques[j];
              try {
                const c = await buildEvaluacionTecnicaPDF(b.slice, {
                  numeroInicial: b.from,
                  subtitulo: `Bloque del ${b.from} al ${b.to} (${b.slice.length})`,
                  paginaInicial: 1,
                  totalPaginasProyecto: null,
                  dryRun: true,
                  fotosMap: map,
                });
                pag[j] = (c && c.totalPages) || 0;
              } catch { break; }
              if (taskId !== bgTaskRef.current) return;
              await new Promise((r) => setTimeout(r, 0));
            }
            saveBloquePages(sig, pag);
          })();
        }
      } else {
        await buildEvaluacionTecnicaExcel(slice, {
          numeroInicial: from,
          subtitulo: `Bloque del ${from} al ${to} (${slice.length})`,
          nombreArchivo: `Ficha_Evaluacion_Tecnica_${rango}_${dateStr}.xlsx`,
        });
        toast({ title: "Reporte generado", description: `Excel del ${from} al ${to} descargado.` });
      }
    } catch (err) {
      toast({ title: "Error", description: `No se pudo generar el reporte: ${err?.message || ""}`, variant: "destructive" });
    } finally {
      setGeneratingKey(null);
    }
  };

  const handleGenerateTodo = async (formato) => {
    await handleGenerate(`todo-${formato}`, formato, rows, 1, rows.length);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[94vw] sm:max-w-[440px] p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base sm:text-lg leading-tight flex items-center gap-2">
            <Layers className="h-5 w-5 shrink-0" />
            Evaluación Técnica por bloques
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm leading-tight">
            {isLoading
              ? "Cargando activos (estado=1, BUENO/REGULAR)..."
              : rows.length > 0
                ? `Se encontraron ${rows.length} activos. Descargue por bloques de ${EV_TECNICA_BLOQUE} o el reporte completo.`
                : "No hay activos con ese criterio."}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando lista...
          </div>
        ) : (
          <div className="grid gap-2 py-2">
            {rows.length > 0 && (
              <div className="grid grid-cols-2 gap-2 pb-1">
                <Button
                  onClick={() => handleGenerateTodo("excel")}
                  disabled={generatingKey !== null}
                  className="bg-green-700 hover:bg-green-800 text-white w-full min-h-11 text-xs sm:text-sm"
                >
                  {generatingKey === "todo-excel" ? <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" /> : <FileDown className="mr-2 h-4 w-4 shrink-0" />}
                  {generatingKey === "todo-excel" ? "Generando..." : `Excel todo (${rows.length})`}
                </Button>
                <Button
                  onClick={() => handleGenerateTodo("pdf")}
                  disabled={generatingKey !== null}
                  className="bg-red-600 hover:bg-red-700 text-white w-full min-h-11 text-xs sm:text-sm"
                >
                  {generatingKey === "todo-pdf" ? <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" /> : <FileText className="mr-2 h-4 w-4 shrink-0" />}
                  {generatingKey === "todo-pdf" ? "Generando..." : `PDF todo (${rows.length})`}
                </Button>
              </div>
            )}
            {bloques.map((b, bIdx) => (
              <div key={`${b.from}-${b.to}`} className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => handleGenerate(`excel-${b.from}`, "excel", b.slice, b.from, b.to, bIdx)}
                  disabled={generatingKey !== null}
                  className="bg-green-700 hover:bg-green-800 text-white w-full min-h-11 text-xs sm:text-sm justify-between"
                >
                  <span className="flex items-center gap-2">
                    {generatingKey === `excel-${b.from}` ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <FileDown className="h-4 w-4 shrink-0" />}
                    {generatingKey === `excel-${b.from}` ? "Generando..." : `Excel ${b.from}-${b.to}`}
                  </span>
                  <span className="font-mono text-[11px] opacity-90">({b.slice.length})</span>
                </Button>
                <Button
                  onClick={() => handleGenerate(`pdf-${b.from}`, "pdf", b.slice, b.from, b.to, bIdx)}
                  disabled={generatingKey !== null}
                  className="bg-red-600 hover:bg-red-700 text-white w-full min-h-11 text-xs sm:text-sm justify-between"
                >
                  <span className="flex items-center gap-2">
                    {generatingKey === `pdf-${b.from}` ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <FileText className="h-4 w-4 shrink-0" />}
                    {generatingKey === `pdf-${b.from}` ? "Generando..." : `PDF ${b.from}-${b.to}`}
                  </span>
                  <span className="font-mono text-[11px] opacity-90">({b.slice.length})</span>
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EvaluacionTecnicaBloquesModal;
