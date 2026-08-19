import { useState } from "react";
import { CalendarDays, Loader2, Search, X, FileDown } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const InventarioFechaModal = ({
  isOpen,
  onClose,
  getDisplayName,
  loadActivosPorFecha,
}) => {
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleBuscar = async () => {
    if (!fechaDesde || !fechaHasta) return;
    setIsLoading(true);
    try {
      const data = await loadActivosPorFecha({ fechaDesde, fechaHasta });
      setResult(data);
    } catch (e) {
      console.error("Error cargando activos por fecha:", e);
      setResult([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLimpiar = () => {
    setFechaDesde("");
    setFechaHasta("");
    setResult(null);
  };

  const totalGeneral = result ? result.reduce((acc, r) => acc + r.total, 0) : 0;

  const handleGenerarPdf = () => {
    if (!result) return;
    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF("landscape", "mm", "letter");
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("ACTIVOS POR INVENTARIADOR Y FECHA", pageWidth / 2, 16, { align: "center" });
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Desde: ${fechaDesde || "—"}    Hasta: ${fechaHasta || "—"}`, pageWidth / 2, 23, { align: "center" });

      const body = result.map((stat, i) => [
        i + 1,
        getDisplayName(stat.email),
        stat.total,
      ]);
      body.push(["", "TOTAL GENERAL", totalGeneral]);

      autoTable(doc, {
        startY: 28,
        head: [["N°", "INVENTARIADOR", "TOTAL DE ACTIVOS"]],
        body,
        styles: { fontSize: 10, cellPadding: 2.5 },
        headStyles: { fillColor: [33, 115, 70], textColor: 255, halign: "center" },
        columnStyles: {
          0: { halign: "center", cellWidth: 20 },
          2: { halign: "center", cellWidth: 40 },
        },
        didParseCell: (data) => {
          if (data.row.index === body.length - 1 && data.section === "body") {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = [226, 239, 218];
          }
        },
      });

      const safeLabel = `${fechaDesde}_${fechaHasta}`.replace(/[^a-zA-Z0-9]+/g, "_");
      doc.save(`Activos_Por_Inventariador_${safeLabel}.pdf`);
    } catch (e) {
      console.error("Error generando PDF:", e);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[96vw] sm:max-w-[720px] max-h-[90vh] flex flex-col p-6">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Activos por Inventariador y Fecha
          </DialogTitle>
          <DialogDescription>
            Seleccione un rango de fechas para ver cuántos activos registró cada inventariador.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3 my-2">
          <div className="grid gap-1.5">
            <Label htmlFor="fechaDesde">Desde</Label>
            <Input
              id="fechaDesde"
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fechaHasta">Hasta</Label>
            <Input
              id="fechaHasta"
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            className="ml-auto bg-sky-300 hover:bg-sky-400 text-sky-950 border-sky-400"
            onClick={handleGenerarPdf}
            disabled={isGeneratingPdf || !result}
          >
            {isGeneratingPdf ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4 mr-2" />
            )}
            REPORTE EN PDF
          </Button>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <Button
            onClick={handleBuscar}
            disabled={isLoading || !fechaDesde || !fechaHasta}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            Buscar
          </Button>
          <Button variant="outline" onClick={handleLimpiar} disabled={isLoading}>
            <X className="h-4 w-4 mr-2" />
            Limpiar
          </Button>
        </div>

        {isLoading ? (
          <div className="flex flex-col justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-muted-foreground animate-pulse">
              Cargando activos por fecha...
            </p>
          </div>
        ) : result ? (
          <div className="flex-1 min-h-0 overflow-auto border rounded-md">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0">
                <TableRow>
                  <TableHead className="w-[60px]">N°</TableHead>
                  <TableHead>Inventariador</TableHead>
                  <TableHead className="w-[160px] text-right">
                    Total de Activos
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground py-8"
                    >
                      No se encontraron activos en el rango de fechas seleccionado.
                    </TableCell>
                  </TableRow>
                ) : (
                  result.map((stat, i) => (
                    <TableRow key={stat.email}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">
                        {getDisplayName(stat.email)}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {stat.total}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {result && result.length > 0 && (
          <div className="flex justify-end px-4 py-2 border rounded-md bg-muted/20">
            <span className="text-sm font-semibold">
              Total general: <span className="text-blue-600 dark:text-blue-400">{totalGeneral}</span>
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default InventarioFechaModal;