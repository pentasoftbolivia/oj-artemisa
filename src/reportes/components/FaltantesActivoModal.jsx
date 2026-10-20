import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileDown, FileSpreadsheet, Loader2, PackageSearch } from "lucide-react";
import { useReporteFaltantesActivo } from "@/inicio/hooks/useReporteFaltantesActivo";
import { useReporteFaltantesActivoExcel } from "@/inicio/hooks/useReporteFaltantesActivoExcel";

const FaltantesActivoModal = ({ open, onOpenChange }) => {
  const { generate: generatePDF, isGenerating: isGeneratingPDF } = useReporteFaltantesActivo();
  const { generate: generateExcel, isGenerating: isGeneratingExcel } = useReporteFaltantesActivoExcel();

  const busy = isGeneratingPDF || isGeneratingExcel;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[94vw] sm:max-w-[440px] p-4 sm:p-6">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base sm:text-lg leading-tight flex items-center gap-2">
            <PackageSearch className="h-5 w-5 shrink-0" />
            Faltantes en estado activo
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm leading-tight">
            Activos con estadoinventario NULL o vacío y artemisaaltabaja=1. Elija el formato a descargar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
          <Button
            onClick={() => generateExcel()}
            disabled={busy}
            className="bg-green-700 hover:bg-green-800 text-white w-full min-h-11 text-xs sm:text-sm"
          >
            {isGeneratingExcel ? <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" /> : <FileSpreadsheet className="mr-2 h-4 w-4 shrink-0" />}
            {isGeneratingExcel ? "Generando..." : "Generar Excel"}
          </Button>
          <Button
            onClick={() => generatePDF()}
            disabled={busy}
            className="bg-red-600 hover:bg-red-700 text-white w-full min-h-11 text-xs sm:text-sm"
          >
            {isGeneratingPDF ? <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" /> : <FileDown className="mr-2 h-4 w-4 shrink-0" />}
            {isGeneratingPDF ? "Generando..." : "Generar PDF"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FaltantesActivoModal;
