import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileDown, FileSpreadsheet, Loader2, Boxes } from "lucide-react";
import { useObsoletosGrupoContable } from "@/inicio/hooks/useObsoletosGrupoContable";

const ObsoletosGrupoModal = ({ open, onOpenChange }) => {
  const { grupos, total, isLoading, isGenerating, fetchGrupos, generateExcel, generatePDF } =
    useObsoletosGrupoContable();

  useEffect(() => {
    if (open) fetchGrupos();
  }, [open, fetchGrupos]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[94vw] sm:max-w-[860px] p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base sm:text-lg leading-tight flex items-center gap-2">
            <Boxes className="h-5 w-5 shrink-0" />
            Obsoletos por grupo contable
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm leading-tight">
            {isLoading
              ? "Cargando activos (ultimoregistro=1, estado=1, MALO)..."
              : total > 0
                ? `${total} activos en ${grupos.length} rubros (sin biblioteca, edificaciones ni terrenos).`
                : "No hay activos obsoletos con ese criterio."}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando activos...
            </div>
          ) : grupos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              No hay activos obsoletos con ese criterio.
            </p>
          ) : (
            <div className="max-h-[46vh] overflow-y-auto p-3">
              <table className="w-full text-xs sm:text-sm border-collapse">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="border px-2 py-1.5 text-center w-10">N°</th>
                    <th className="border px-2 py-1.5 text-left">Rubro</th>
                    <th className="border px-2 py-1.5 text-center w-32">Cantidad activos</th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map((g, idx) => (
                    <tr key={g.rubro} className="odd:bg-white even:bg-muted/40">
                      <td className="border px-2 py-1 text-center">{idx + 1}</td>
                      <td className="border px-2 py-1 font-medium">{g.rubro}</td>
                      <td className="border px-2 py-1 text-center font-mono font-semibold">{g.items.length}</td>
                    </tr>
                  ))}
                  <tr className="bg-blue-50 font-bold">
                    <td className="border px-2 py-1 text-center" colSpan={2}>TOTAL</td>
                    <td className="border px-2 py-1 text-center font-mono">{total}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
          <Button
            onClick={() => generateExcel()}
            disabled={total === 0 || isGenerating || isLoading}
            className="bg-green-700 hover:bg-green-800 text-white w-full min-h-11 text-xs sm:text-sm"
          >
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" /> : <FileSpreadsheet className="mr-2 h-4 w-4 shrink-0" />}
            {isGenerating ? "Generando..." : "Generar Excel"}
          </Button>
          <Button
            onClick={() => generatePDF()}
            disabled={total === 0 || isGenerating || isLoading}
            className="bg-red-600 hover:bg-red-700 text-white w-full min-h-11 text-xs sm:text-sm"
          >
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" /> : <FileDown className="mr-2 h-4 w-4 shrink-0" />}
            {isGenerating ? "Generando..." : "Generar PDF"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ObsoletosGrupoModal;
