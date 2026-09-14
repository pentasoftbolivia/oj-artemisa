import { useState, useMemo } from "react";
import { CalendarDays, Loader2, Search, X, FileDown, FileSpreadsheet } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { LOGO_JPG_DATA_URL } from "@/lib/logoJpgBase64";
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
  loadEnProcesoAcumulado,
}) => {
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [rawData, setRawData] = useState(null);
  const [acumuladoMap, setAcumuladoMap] = useState({});
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);

  const handleBuscar = async () => {
    if (!fechaDesde || !fechaHasta) return;
    setIsLoading(true);
    try {
      const [{ aggregated, rawRows }, acumulado] = await Promise.all([
        loadActivosPorFecha({ fechaDesde, fechaHasta }),
        loadEnProcesoAcumulado ? loadEnProcesoAcumulado() : Promise.resolve({}),
      ]);
      setResult(aggregated);
      setRawData(rawRows);
      setAcumuladoMap(acumulado || {});
    } catch (e) {
      console.error("Error cargando activos por fecha:", e);
      setResult([]);
      setRawData([]);
      setAcumuladoMap({});
    } finally {
      setIsLoading(false);
    }
  };

  const handleLimpiar = () => {
    setFechaDesde("");
    setFechaHasta("");
    setResult(null);
    setRawData(null);
    setAcumuladoMap({});
  };

  const sortedResult = useMemo(() => {
    if (!result) return null;
    const withAcumulado = result.map((r) => ({
      ...r,
      enProcesoAcumulado: acumuladoMap[r.email] ?? 0,
    }));
    return withAcumulado.sort((a, b) => b.total - a.total);
  }, [result, acumuladoMap]);

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
  const totalEnProcesoAcumulado = sortedResult ? sortedResult.reduce((acc, r) => acc + (r.enProcesoAcumulado || 0), 0) : 0;
  const totalInventariado = sortedResult ? sortedResult.reduce((acc, r) => acc + r.inventariado, 0) : 0;
  const totalRevisado = sortedResult ? sortedResult.reduce((acc, r) => acc + r.revisado, 0) : 0;
  const totalGeneral = totalInventariado + totalRevisado;

  const handleGenerarPdf = () => {
    if (!sortedResult) return;
    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF("landscape", "mm", "letter");
      try { doc.addImage(LOGO_JPG_DATA_URL, "JPEG", 14, 8, 48, 48 * (57/256)); } catch {
        // ignore logo errors
      }
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
        stat.enProcesoAcumulado || 0,
        stat.enProceso,
        stat.inventariado,
        stat.revisado,
        stat.total,
      ]);
      body.push(["", "TOTAL GENERAL", totalEnProcesoAcumulado, totalEnProceso, totalInventariado, totalRevisado, totalGeneral]);

      autoTable(doc, {
        startY: 28,
        head: [["N°", "INVENTARIADOR", "EN PROCESO\nACUMULADO", "EN PROCESO", "INVENTARIADO", "REVISADO", "TOTAL DE ACTIVOS"]],
        body,
        styles: { fontSize: 9, cellPadding: 2, valign: "middle" },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, halign: "center", valign: "middle" },
        columnStyles: {
          0: { halign: "center", cellWidth: 12 },
          1: { halign: "left" },
          2: { halign: "center", cellWidth: 32, textColor: [180, 83, 9], fontStyle: "bold", fillColor: [254, 243, 199] },
          3: { halign: "center", cellWidth: 28, textColor: [128, 128, 128] },
          4: { halign: "center", cellWidth: 28, fontStyle: "bold" },
          5: { halign: "center", cellWidth: 28, fontStyle: "bold" },
          6: { halign: "center", cellWidth: 36, fontStyle: "bold" },
        },
        didParseCell: (data) => {
          if (data.row.index === body.length - 1 && data.section === "body") {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = [219, 234, 254];
          }
        },
      });

      const pageH = doc.internal.pageSize.getHeight();
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        if (i > 1) {
          try { doc.addImage(LOGO_JPG_DATA_URL, "JPEG", 14, 8, 48, 48 * (57/256)); } catch {
            // ignore logo errors
          }
        }
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageH - 8, { align: "center" });
      }

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
        ["FECHA", "INVENTARIADOR", "EN PROCESO\nACUMULADO", "EN PROCESO", "INVENTARIADO", "REVISADO", "TOTAL"]
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
          let dailyEnProcesoAcum = 0;
          let dailyInventariado = 0;
          let dailyRevisado = 0;
          let dailyTotal = 0;

          Object.entries(usersInDate)
            .sort(([, a], [, b]) => (b.inventariado + b.revisado) - (a.inventariado + a.revisado))
            .forEach(([email, counts]) => {
            const userTotal = counts.inventariado + counts.revisado;
            const acumulado = acumuladoMap[email] ?? 0;
            excelData.push([
              date,
              getDisplayName(email),
              acumulado,
              counts.enProceso,
              counts.inventariado,
              counts.revisado,
              userTotal
            ]);
            dailyEnProcesoAcum += acumulado;
            dailyEnProceso += counts.enProceso;
            dailyInventariado += counts.inventariado;
            dailyRevisado += counts.revisado;
            dailyTotal += userTotal;
          });

          excelData.push([
            "",
            "TOTAL DEL DÍA",
            dailyEnProcesoAcum,
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
        { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, // A1:G1
        { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } }  // A2:G2
      ];

      const columnWidths = [
        { wch: 15 },
        { wch: 35 },
        { wch: 15 },
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
      <DialogContent className="w-full max-w-[96vw] sm:max-w-[1080px] max-h-[92vh] sm:max-h-[90vh] flex flex-col p-3 sm:p-6 gap-3 overflow-hidden">
        <DialogHeader className="shrink-0 pr-6 space-y-1">
          <DialogTitle className="text-base sm:text-xl flex items-center gap-2 leading-tight">
            <CalendarDays className="h-5 w-5 shrink-0" />
            Activos por Inventariador y Fecha
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm leading-tight">
            Seleccione un rango de fechas para ver cuántos activos registró cada inventariador.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 my-1 sm:my-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="fechaDesde" className="text-xs sm:text-sm">Desde</Label>
              <Input
                id="fechaDesde"
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="min-h-11 sm:min-h-9 text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fechaHasta" className="text-xs sm:text-sm">Hasta</Label>
              <Input
                id="fechaHasta"
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="min-h-11 sm:min-h-9 text-sm"
              />
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full bg-green-300 hover:bg-green-400 text-green-950 border-green-400 min-h-11 sm:min-h-9 text-xs sm:text-sm"
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

        <div className="flex flex-col sm:flex-row gap-2 mb-2">
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              onClick={handleBuscar}
              disabled={isLoading || !fechaDesde || !fechaHasta}
              className="flex-1 sm:flex-none min-h-11 sm:min-h-9"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Buscar
            </Button>
            <Button variant="outline" onClick={handleLimpiar} disabled={isLoading} className="flex-1 sm:flex-none min-h-11 sm:min-h-9">
              <X className="h-4 w-4 mr-2" />
              Limpiar
            </Button>
          </div>

          <Button
            variant="outline"
            className="w-full sm:w-auto sm:ml-auto bg-sky-300 hover:bg-sky-400 text-sky-950 border-sky-400 min-h-11 sm:min-h-9 text-xs sm:text-sm"
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
          <div className="flex-1 min-h-0 overflow-auto overscroll-contain space-y-0">
            {sortedResult.length === 0 ? (
              <div className="border rounded-md text-center text-muted-foreground py-8 text-sm">
                No se encontraron activos en el rango de fechas seleccionado.
              </div>
            ) : (
              <>
                {/* MÓVIL: cards */}
                <div className="sm:hidden space-y-3 pr-1">
                  {sortedResult.map((stat, i) => (
                    <div key={stat.email} className="rounded-lg border bg-card p-3 space-y-2.5 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[11px] text-muted-foreground font-medium">#{i + 1} · Inventariador</div>
                          <div className="text-sm font-semibold leading-tight truncate" title={getDisplayName(stat.email)}>
                            {getDisplayName(stat.email)}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">{stat.email}</div>
                        </div>
                        <div className="shrink-0 rounded-md bg-blue-600 text-white px-2.5 py-1.5 text-center min-w-[56px]">
                          <div className="text-[10px] uppercase leading-none opacity-90">Total</div>
                          <div className="text-lg font-extrabold leading-none">{stat.total}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-2 text-center">
                          <div className="text-[9px] uppercase font-semibold text-amber-700 dark:text-amber-300 leading-tight">Acum.<br/>En Proc.</div>
                          <div className="text-sm font-bold text-amber-700 dark:text-amber-300">{stat.enProcesoAcumulado ?? 0}</div>
                        </div>
                        <div className="rounded-md bg-muted/50 border p-2 text-center">
                          <div className="text-[9px] uppercase font-semibold text-muted-foreground leading-tight">En<br/>Proceso</div>
                          <div className="text-sm font-bold">{stat.enProceso}</div>
                        </div>
                        <div className="rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 p-2 text-center">
                          <div className="text-[9px] uppercase font-semibold text-green-700 dark:text-green-300 leading-tight">Invent.</div>
                          <div className="text-sm font-bold text-green-700 dark:text-green-300">{stat.inventariado}</div>
                        </div>
                        <div className="rounded-md bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 p-2 text-center">
                          <div className="text-[9px] uppercase font-semibold text-yellow-700 dark:text-yellow-400 leading-tight">Revisado</div>
                          <div className="text-sm font-bold text-yellow-700 dark:text-yellow-300">{stat.revisado}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs border-t pt-2">
                        <div>
                          <div className="text-[10px] uppercase font-semibold text-muted-foreground">Primer registro</div>
                          <div className="text-xs leading-tight break-words">{formatFecha(stat.primerRegistro)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-semibold text-muted-foreground">Último registro</div>
                          <div className="text-xs leading-tight break-words">{formatFecha(stat.ultimoRegistro)}</div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Total general móvil */}
                  <div className="rounded-lg border-2 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30 p-3 space-y-2">
                    <div className="text-xs font-bold text-blue-700 dark:text-blue-300 tracking-wide text-center">TOTAL GENERAL</div>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="text-center">
                        <div className="text-[9px] uppercase text-muted-foreground font-semibold">Acum.</div>
                        <div className="text-sm font-bold text-amber-700 dark:text-amber-300">{totalEnProcesoAcumulado}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[9px] uppercase text-muted-foreground font-semibold">En Proc.</div>
                        <div className="text-sm font-bold">{totalEnProceso}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[9px] uppercase text-muted-foreground font-semibold">Invent.</div>
                        <div className="text-sm font-bold text-green-700 dark:text-green-300">{totalInventariado}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[9px] uppercase text-muted-foreground font-semibold">Revisado</div>
                        <div className="text-sm font-bold">{totalRevisado}</div>
                      </div>
                    </div>
                    <div className="text-center border-t border-blue-200 dark:border-blue-800 pt-2">
                      <span className="text-xs text-muted-foreground">Total activos: </span>
                      <span className="text-lg font-extrabold text-blue-700 dark:text-blue-300">{totalGeneral}</span>
                    </div>
                  </div>
                </div>

                {/* DESKTOP: tabla */}
                <div className="hidden sm:block border rounded-md overflow-auto">
                  <Table>
                    <TableHeader className="bg-muted/50 sticky top-0">
                      <TableRow>
                        <TableHead className="w-[40px]">N°</TableHead>
                        <TableHead>Inventariador</TableHead>
                        <TableHead className="text-center bg-amber-50 dark:bg-amber-950/30">
                          <div className="flex flex-col leading-tight py-1 text-xs font-medium">
                            <span>En Proceso</span>
                            <span>Acumulado</span>
                          </div>
                        </TableHead>
                        <TableHead className="text-center">En Proceso</TableHead>
                        <TableHead className="text-center">Inventariado</TableHead>
                        <TableHead className="text-center">Revisado</TableHead>
                        <TableHead className="text-center">Total</TableHead>
                        <TableHead className="text-center whitespace-nowrap">Primer Registro</TableHead>
                        <TableHead className="text-center whitespace-nowrap">Último Registro</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedResult.map((stat, i) => (
                        <TableRow key={stat.email}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-medium">
                            {getDisplayName(stat.email)}
                          </TableCell>
                          <TableCell className="text-center font-bold bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300">
                            {stat.enProcesoAcumulado ?? 0}
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
                      ))}
                    </TableBody>
                    {sortedResult.length > 0 && (
                      <TableFooter className="bg-muted/50">
                        <TableRow>
                          <TableCell colSpan={2} className="font-bold">
                            TOTAL GENERAL
                          </TableCell>
                          <TableCell className="text-center font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
                            {totalEnProcesoAcumulado}
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
              </>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default InventarioFechaModal;
