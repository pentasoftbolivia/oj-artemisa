import { useState, useMemo } from "react";
import { CalendarDays, Loader2, Search, X, FileDown, FileSpreadsheet } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
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
  TableFooter,
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
  const [rawData, setRawData] = useState(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);

  const handleBuscar = async () => {
    if (!fechaDesde || !fechaHasta) return;
    setIsLoading(true);
    try {
      const { aggregated, rawRows } = await loadActivosPorFecha({ fechaDesde, fechaHasta });
      setResult(aggregated);
      setRawData(rawRows);
    } catch (e) {
      console.error("Error cargando activos por fecha:", e);
      setResult([]);
      setRawData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLimpiar = () => {
    setFechaDesde("");
    setFechaHasta("");
    setResult(null);
    setRawData(null);
  };

  const sortedResult = useMemo(
    () => (result ? [...result].sort((a, b) => b.total - a.total) : null),
    [result],
  );

  const formatFecha = (iso) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return String(iso).split("T")[0];
      return d.toLocaleString("es-BO", { dateStyle: "short", timeStyle: "short" });
    } catch {
      return String(iso);
    }
  };

  const totalEnProceso = sortedResult ? sortedResult.reduce((acc, r) => acc + r.enProceso, 0) : 0;
  const totalInventariado = sortedResult ? sortedResult.reduce((acc, r) => acc + r.inventariado, 0) : 0;
  const totalRevisado = sortedResult ? sortedResult.reduce((acc, r) => acc + r.revisado, 0) : 0;
  const totalGeneral = totalInventariado + totalRevisado;

  const handleGenerarPdf = () => {
    if (!sortedResult) return;
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

      const body = sortedResult.map((stat, i) => [
        i + 1,
        getDisplayName(stat.email),
        stat.enProceso,
        stat.inventariado,
        stat.revisado,
        stat.total,
        formatFecha(stat.primerRegistro),
        formatFecha(stat.ultimoRegistro),
      ]);
      body.push(["", "TOTAL GENERAL", totalEnProceso, totalInventariado, totalRevisado, totalGeneral, "", ""]);

      autoTable(doc, {
        startY: 28,
        head: [["N°", "INVENTARIADOR", "EN PROCESO", "INVENTARIADO", "REVISADO", "TOTAL DE ACTIVOS", "PRIMER REGISTRO", "ULTIMO REGISTRO"]],
        body,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [33, 115, 70], textColor: 255, halign: "center", fontSize: 7 },
        columnStyles: {
          0: { halign: "center", cellWidth: 12 },
          1: { halign: "left", cellWidth: 38 },
          2: { halign: "center", cellWidth: 24, textColor: [128, 128, 128] },
          3: { halign: "center", cellWidth: 24, fontStyle: "bold" },
          4: { halign: "center", cellWidth: 24, fontStyle: "bold" },
          5: { halign: "center", cellWidth: 28, fontStyle: "bold" },
          6: { halign: "center", cellWidth: 32, fontSize: 7 },
          7: { halign: "center", cellWidth: 32, fontSize: 7 },
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

  const handleGenerarExcel = () => {
    if (!rawData) return;
    setIsGeneratingExcel(true);
    try {
      const ESTADO_FECHA_KEYS = {
        "EN PROCESO": "enProceso",
        INVENTARIADO: "inventariado",
        REVISADO: "revisado",
      };

      const groupedByDayAndUser = {};

      rawData.forEach((r) => {
        const email = r.usuarioinventario;
        if (!email) return;

        const dateStr = r.fecharegistro ? r.fecharegistro.split("T")[0] : "Sin Fecha";
        const stateKey = ESTADO_FECHA_KEYS[String(r.estadoinventario || "").trim().toUpperCase()];

        if (!groupedByDayAndUser[dateStr]) {
          groupedByDayAndUser[dateStr] = {};
        }
        if (!groupedByDayAndUser[dateStr][email]) {
          groupedByDayAndUser[dateStr][email] = { enProceso: 0, inventariado: 0, revisado: 0 };
        }
        if (stateKey) {
          groupedByDayAndUser[dateStr][email][stateKey] += 1;
        }
      });

      const excelData = [
        ["REPORTE DIARIO DE ACTIVOS POR INVENTARIADOR"],
        [`Desde: ${fechaDesde || "—"}    Hasta: ${fechaHasta || "—"}`],
        [],
        ["FECHA", "INVENTARIADOR", "EN PROCESO", "INVENTARIADO", "REVISADO", "TOTAL"]
      ];

      // Generar todas las fechas en el rango
      const dateRange = [];
      if (fechaDesde && fechaHasta) {
        let currentDate = new Date(`${fechaDesde}T00:00:00`);
        const endDate = new Date(`${fechaHasta}T00:00:00`);
        while (currentDate <= endDate) {
          dateRange.push(currentDate.toISOString().split("T")[0]);
          currentDate.setDate(currentDate.getDate() + 1);
        }
      } else {
        dateRange.push(...Object.keys(groupedByDayAndUser).sort());
      }

      dateRange.forEach(date => {
        const usersInDate = groupedByDayAndUser[date];
        if (usersInDate && Object.keys(usersInDate).length > 0) {
          let dailyEnProceso = 0;
          let dailyInventariado = 0;
          let dailyRevisado = 0;
          let dailyTotal = 0;

          Object.entries(usersInDate)
            .sort(([, a], [, b]) => (b.inventariado + b.revisado) - (a.inventariado + a.revisado))
            .forEach(([email, counts]) => {
            const userTotal = counts.inventariado + counts.revisado;
            excelData.push([
              date,
              getDisplayName(email),
              counts.enProceso,
              counts.inventariado,
              counts.revisado,
              userTotal
            ]);
            dailyEnProceso += counts.enProceso;
            dailyInventariado += counts.inventariado;
            dailyRevisado += counts.revisado;
            dailyTotal += userTotal;
          });

          excelData.push([
            "",
            "TOTAL DEL DÍA",
            dailyEnProceso,
            dailyInventariado,
            dailyRevisado,
            dailyTotal
          ]);
        } else {
          excelData.push([
            date,
            "Sin actividad",
            0,
            0,
            0,
            0
          ]);
        }
        // Añadir fila en blanco para separar visualmente por día
        excelData.push([]);
      });

      const worksheet = XLSX.utils.aoa_to_sheet(excelData);

      // Combinar celdas para el título y el subtítulo
      worksheet["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, // A1:F1
        { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }  // A2:F2
      ];

      const columnWidths = [
        { wch: 15 },
        { wch: 35 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 12 }
      ];
      worksheet["!cols"] = columnWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte Diario");

      const safeLabel = `${fechaDesde}_${fechaHasta}`.replace(/[^a-zA-Z0-9]+/g, "_");
      XLSX.writeFile(workbook, `Reporte_Diario_${safeLabel}.xlsx`);
    } catch (e) {
      console.error("Error generando Excel:", e);
    } finally {
      setIsGeneratingExcel(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[96vw] sm:max-w-[960px] max-h-[90vh] flex flex-col p-6">
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
            className="ml-auto bg-green-300 hover:bg-green-400 text-green-950 border-green-400 w-[260px]"
            onClick={handleGenerarExcel}
            disabled={isGeneratingExcel || !rawData}
          >
            {isGeneratingExcel ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 mr-2" />
            )}
            REPORTE POR DIAS EN EXCEL
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-2">
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

          <Button
            variant="outline"
            className="ml-auto bg-sky-300 hover:bg-sky-400 text-sky-950 border-sky-400 w-[260px]"
            onClick={handleGenerarPdf}
            disabled={isGeneratingPdf || !sortedResult}
          >
            {isGeneratingPdf ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4 mr-2" />
            )}
            REPORTE TOTALES EN PDF
          </Button>
        </div>

        {isLoading ? (
          <div className="flex flex-col justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-muted-foreground animate-pulse">
              Cargando activos por fecha...
            </p>
          </div>
        ) : sortedResult ? (
          <div className="flex-1 min-h-0 overflow-auto border rounded-md">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0">
                <TableRow>
                  <TableHead className="w-[50px]">N°</TableHead>
                  <TableHead>Inventariador</TableHead>
                  <TableHead className="text-center">En Proceso</TableHead>
                  <TableHead className="text-center">Inventariado</TableHead>
                  <TableHead className="text-center">Revisado</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center whitespace-nowrap">Primer Registro</TableHead>
                  <TableHead className="text-center whitespace-nowrap">Último Registro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedResult.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-muted-foreground py-8"
                    >
                      No se encontraron activos en el rango de fechas seleccionado.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedResult.map((stat, i) => (
                    <TableRow key={stat.email}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">
                        {getDisplayName(stat.email)}
                      </TableCell>
                      <TableCell className="text-center">{stat.enProceso}</TableCell>
                      <TableCell className="text-center">{stat.inventariado}</TableCell>
                      <TableCell className="text-center">{stat.revisado}</TableCell>
                      <TableCell className="text-center font-bold">
                        {stat.total}
                      </TableCell>
                      <TableCell className="text-center text-xs whitespace-nowrap">{formatFecha(stat.primerRegistro)}</TableCell>
                      <TableCell className="text-center text-xs whitespace-nowrap">{formatFecha(stat.ultimoRegistro)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {sortedResult.length > 0 && (
                <TableFooter className="bg-muted/50">
                  <TableRow>
                    <TableCell colSpan={2} className="font-bold">
                      TOTAL GENERAL
                    </TableCell>
                    <TableCell className="text-center font-bold">
                      {totalEnProceso}
                    </TableCell>
                    <TableCell className="text-center font-bold">
                      {totalInventariado}
                    </TableCell>
                    <TableCell className="text-center font-bold">
                      {totalRevisado}
                    </TableCell>
                    <TableCell className="text-center font-bold text-blue-600 dark:text-blue-400">
                      {totalGeneral}
                    </TableCell>
                    <TableCell colSpan={2} className="text-center text-xs text-muted-foreground">—</TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default InventarioFechaModal;