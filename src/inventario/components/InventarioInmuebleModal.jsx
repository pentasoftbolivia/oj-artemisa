import { useState, useMemo } from "react";
import { Building2, Users, Loader2, Search, X, ChevronLeft, ChevronRight, FileDown } from "lucide-react";
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
import ComboboxField from "@/components/ui/combobox-field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const InventarioInmuebleModal = ({
  isOpen,
  onClose,
  ciudadOptions = [],
  inmuebleOptions = [],
  inmuebleCiudadMap = {},
  getDisplayName,
  loadInmuebleSummary,
  loadInmueblePendientes,
  getAmbienteName,
  getResponsableName,
  rubroFromTipo,
  tipoRubroDescMap,
}) => {
  const [ciudad, setCiudad] = useState("");
  const [inmueble, setInmueble] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [pendientes, setPendientes] = useState([]);
  const [pendientesPage, setPendientesPage] = useState(1);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);
  const PENDIENTES_PAGE_SIZE = 3;

  const filteredInmuebleOptions = useMemo(() => {
    if (!ciudad) return inmuebleOptions;
    return inmuebleOptions.filter(
      (o) => inmuebleCiudadMap[String(o.value).trim()] === String(ciudad).trim(),
    );
  }, [inmuebleOptions, inmuebleCiudadMap, ciudad]);

  const pendientesTotalPages = useMemo(
    () => Math.max(1, Math.ceil(pendientes.length / PENDIENTES_PAGE_SIZE)),
    [pendientes],
  );
  const pendientesPageData = useMemo(() => {
    const start = (pendientesPage - 1) * PENDIENTES_PAGE_SIZE;
    return pendientes.slice(start, start + PENDIENTES_PAGE_SIZE);
  }, [pendientes, pendientesPage]);

  const handleBuscar = async () => {
    setIsLoading(true);
    try {
      const data = await loadInmuebleSummary({ ciudad, inmueble });
      setResult(data);
    } catch (e) {
      console.error("Error loading inmueble summary:", e);
      setResult({ totalInmueble: 0, totalInventariado: 0, perUser: [] });
    }
    try {
      const pend = await loadInmueblePendientes({ ciudad, inmueble });
      setPendientes(pend || []);
      setPendientesPage(1);
    } catch (e) {
      console.error("Error loading pendientes:", e);
      setPendientes([]);
    }
    setIsLoading(false);
  };

  const handleLimpiar = () => {
    setCiudad("");
    setInmueble("");
    setResult(null);
    setPendientes([]);
    setPendientesPage(1);
  };

  const handleClose = () => {
    handleLimpiar();
    onClose();
  };

  const handleGenerarPdf = () => {
    if (pendientes.length === 0) return;
    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.text("ACTIVOS POR INVENTARIAR", pageWidth / 2, 15, { align: "center" });

      doc.setFontSize(9);
      const selectedCiudad = ciudadOptions.find((o) => String(o.value).trim() === String(ciudad).trim())?.label || "";
      const selectedInmueble = inmuebleOptions.find((o) => String(o.value).trim() === String(inmueble).trim())?.label || "";

      const drawCenteredBoldLabel = (label, value, xCenter, y) => {
        doc.setFont("helvetica", "bold");
        const labelWidth = doc.getTextWidth(label);
        doc.setFont("helvetica", "normal");
        const valueWidth = doc.getTextWidth(value);
        const totalWidth = labelWidth + valueWidth;
        const startX = xCenter - totalWidth / 2;
        doc.setFont("helvetica", "bold");
        doc.text(label, startX, y);
        doc.setFont("helvetica", "normal");
        doc.text(value, startX + labelWidth, y);
      };

      drawCenteredBoldLabel("CIUDAD: ", `${selectedCiudad || "Todas"}`, pageWidth / 4, 21);
      drawCenteredBoldLabel("INMUEBLE: ", `${selectedInmueble || "Todos"}`, (pageWidth * 3) / 4, 21);

      doc.setFontSize(8);
      doc.text(`Total de activos por inventariar: ${pendientes.length}`, pageWidth / 2, 25, { align: "center" });

      const body = pendientes.map((a) => {
        const trId = a.tipoRubroAct || a.tiporubroact;
        const rubro = (rubroFromTipo[trId] || "").trim();
        const tipo = (tipoRubroDescMap[trId] || "").trim();
        const codBase = (a.codigoActivo ?? a.codigoactivo ?? "").toString().trim();
        return [
          codBase ? `OJ-02-${codBase}` : "—",
          rubro,
          tipo,
          a.descripcionActivo || "—",
          getAmbienteName(String(a.codigoAmbiente ?? "").trim()),
          getResponsableName(a.cirun),
          a.cirun || "—",
        ];
      });

      autoTable(doc, {
        startY: 28,
        head: [["Código", "Rubro", "Tipo Rubro", "Descripción", "Ambiente", "Responsable", "CI Responsable"]],
        body,
        theme: "striped",
        styles: { font: "helvetica", fontSize: 7, cellPadding: 1.2, overflow: "linebreak" },
        headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], halign: "center" },
        columnStyles: {
          0: { cellWidth: 28 },
          1: { cellWidth: 30 },
          2: { cellWidth: 30 },
          3: { cellWidth: "auto" },
          4: { cellWidth: 45 },
          5: { cellWidth: 38 },
          6: { cellWidth: 22, halign: "center" },
        },
        margin: { left: 14, right: 14 },
      });

      const pageHeight = doc.internal.pageSize.getHeight();
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: "center" });
      }

      const safeLabel = (selectedInmueble || "Inmueble").replace(/[^a-zA-Z0-9]+/g, "_");
      doc.save(`Activos_Por_Inventariar_${safeLabel}.pdf`);
    } catch (e) {
      console.error("Error generando PDF:", e);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleGenerarExcel = () => {
    if (!result) return;
    setIsGeneratingExcel(true);
    try {
      const selectedCiudad = ciudadOptions.find((o) => String(o.value).trim() === String(ciudad).trim())?.label || "";
      const selectedInmueble = inmuebleOptions.find((o) => String(o.value).trim() === String(inmueble).trim())?.label || "";
      const porcentaje = result.totalInmueble > 0
        ? Number(((result.totalInventariado / result.totalInmueble) * 100).toFixed(2))
        : 0;

      const wb = XLSX.utils.book_new();

      const rows = [
        ["CIUDAD", selectedCiudad || "Todas"],
        ["INMUEBLE", selectedInmueble || "Todos"],
        [],
        ["TOTAL DE ACTIVOS EN EL INMUEBLE", result.totalInmueble],
        ["TOTAL DE ACTIVOS INVENTARIADOS", result.totalInventariado],
        ["TOTAL DE ACTIVOS EN PROCESO", result.totalEnProceso],
        ["PORCENTAJE DE AVANCE", `${porcentaje}%`],
        [],
        ["INVENTARIADOR", "EN PROCESO", "INVENTARIADOS"],
        ...result.perUser.map((stat) => [
          getDisplayName(stat.email),
          stat.enProceso,
          stat.inventariado,
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [{ wch: 30 }, { wch: 16 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, ws, "Resumen");

      const pendRows = [
        ["CÓDIGO", "RUBRO", "TIPO RUBRO", "DESCRIPCIÓN", "AMBIENTE", "RESPONSABLE", "CI RESPONSABLE"],
        ...pendientes.map((a) => {
          const trId = a.tipoRubroAct || a.tiporubroact;
          const codBase = (a.codigoActivo ?? a.codigoactivo ?? "").toString().trim();
          return [
            codBase ? `OJ-02-${codBase}` : "—",
            (rubroFromTipo[trId] || "").trim(),
            (tipoRubroDescMap[trId] || "").trim(),
            a.descripcionActivo || "—",
            getAmbienteName(String(a.codigoAmbiente ?? "").trim()),
            getResponsableName(a.cirun),
            a.cirun || "—",
          ];
        }),
      ];
      const wsPend = XLSX.utils.aoa_to_sheet(pendRows);
      wsPend["!cols"] = [{ wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 45 }, { wch: 30 }, { wch: 22 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, wsPend, "Por Inventariar");

      const safeLabel = (selectedInmueble || "Inmueble").replace(/[^a-zA-Z0-9]+/g, "_");
      XLSX.writeFile(wb, `Activos_Por_Inmueble_${safeLabel}.xlsx`);
    } catch (e) {
      console.error("Error generando Excel:", e);
    } finally {
      setIsGeneratingExcel(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-[96vw] sm:max-w-[1200px] w-[1200px] max-h-[90vh] flex flex-col p-6">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Activos por Inmueble
          </DialogTitle>
          <DialogDescription>
            Filtre por Ciudad e Inmueble para ver el avance de inventario por inventariador.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col my-2 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ComboboxField
              label="Ciudad"
              value={ciudad}
              onValueChange={(val) => {
                setCiudad(val);
                setInmueble("");
              }}
              options={ciudadOptions}
              placeholder="Seleccionar ciudad..."
              searchPlaceholder="Buscar ciudad..."
              emptyMessage="Sin resultados"
            />
            <ComboboxField
              label="Inmueble"
              value={inmueble}
              onValueChange={setInmueble}
              options={filteredInmuebleOptions}
              placeholder="Seleccionar inmueble..."
              searchPlaceholder="Buscar inmueble..."
              emptyMessage="Sin resultados"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleBuscar}
              disabled={isLoading || !ciudad && !inmueble}
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
              className="ml-auto bg-yellow-400 hover:bg-yellow-500 text-yellow-950 border-yellow-500"
              onClick={handleGenerarExcel}
              disabled={isGeneratingExcel || !result}
            >
              {isGeneratingExcel ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4 mr-2" aria-hidden="true">
                  <path
                    fill="#217346"
                    d="M19.5 3h-9A1.5 1.5 0 0 0 9 4.5V7H4.5A1.5 1.5 0 0 0 3 8.5v9A1.5 1.5 0 0 0 4.5 19H9v.5a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 21 19.5v-15A1.5 1.5 0 0 0 19.5 3z"
                  />
                  <path
                    fill="#fff"
                    d="M9 8.5v7A1.5 1.5 0 0 1 7.5 17H3V7h4.5A1.5 1.5 0 0 1 9 8.5z"
                  />
                  <g fill="#217346">
                    <rect x="9" y="7" width="4" height="1.6" />
                    <rect x="9" y="10" width="4" height="1.6" />
                    <rect x="9" y="13" width="4" height="1.6" />
                    <rect x="9" y="16" width="4" height="1.6" />
                  </g>
                  <g fill="#fff">
                    <path d="M10.4 8.3l1.2 1.2-1.2 1.2-.9-.9-.9.9-1.2-1.2 1.2-1.2.9.9z" transform="translate(-1.4 0.6)" />
                    <path d="M10.4 10.7l1.2 1.2-1.2 1.2-.9-.9-.9.9-1.2-1.2 1.2-1.2.9.9z" transform="translate(-1.4 0.6)" />
                    <path d="M10.4 13.1l1.2 1.2-1.2 1.2-.9-.9-.9.9-1.2-1.2 1.2-1.2.9.9z" transform="translate(-1.4 0.6)" />
                  </g>
                </svg>
              )}
              Reporte de los Paneles en Excel
            </Button>
          </div>

          {isLoading ? (
            <div className="flex flex-col justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="mt-4 text-muted-foreground animate-pulse">
                Cargando datos del inmueble...
              </p>
            </div>
          ) : result ? (
            <div className="flex-1 min-h-0 overflow-auto space-y-4">
              {result.totalInmueble > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col justify-center items-center py-2">
                    <div
                      className="text-sm font-semibold tracking-wide"
                      style={{ color: "#dc2626" }}
                    >
                      PORCENTAJE DE AVANCE
                    </div>
                    <div
                      className="text-4xl font-extrabold animate-flash"
                      style={{
                        color:
                          result.totalInventariado / result.totalInmueble <= 0.5
                            ? "#dc2626"
                            : result.totalInventariado / result.totalInmueble <= 0.8
                              ? "#eab308"
                              : "#16a34a",
                      }}
                    >
                      {(
                        (result.totalInventariado / result.totalInmueble) *
                        100
                      ).toFixed(2)}
                      %
                    </div>
                  </div>
                  <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20 p-4 text-center shadow-sm">
                    <div className="text-sm font-semibold text-blue-600 dark:text-blue-400 tracking-wide">
                      TOTAL DE ACTIVOS EN EL INMUEBLE
                    </div>
                    <div className="text-lg font-bold text-blue-700 dark:text-blue-300 mt-1">
                      {(ciudadOptions.find((o) => String(o.value).trim() === String(ciudad).trim())?.label || "Todas") +
                        " - " +
                        (inmuebleOptions.find((o) => String(o.value).trim() === String(inmueble).trim())?.label || "Todos")}
                    </div>
                    <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                      {result.totalInmueble}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20 p-4 text-center shadow-sm">
                  <div className="text-sm font-semibold text-green-600 dark:text-green-400 tracking-wide">
                    TOTAL DE ACTIVOS INVENTARIADOS
                  </div>
                  <div className="text-3xl font-bold text-green-700 dark:text-green-300">
                    {result.totalInventariado}
                  </div>
                </div>
                <div className="rounded-lg border border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950/20 p-4 text-center shadow-sm">
                  <div className="text-sm font-semibold text-yellow-600 dark:text-yellow-400 tracking-wide">
                    TOTAL DE ACTIVOS EN PROCESO
                  </div>
                  <div className="text-3xl font-bold text-yellow-700 dark:text-yellow-300">
                    {result.totalEnProceso}
                  </div>
                </div>
              </div>

              {result.perUser.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {result.perUser.map((stat) => (
                    <div
                      key={stat.email}
                      className="rounded-lg border p-4 bg-muted/20 space-y-2 min-w-0"
                    >
                      <div
                        className="text-xs font-semibold truncate text-muted-foreground"
                        title={stat.email}
                      >
                        {getDisplayName(stat.email)}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="min-w-0 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded p-2 text-center">
                          <div className="text-xs text-yellow-600 dark:text-yellow-400 font-medium whitespace-nowrap">
                            En Proceso
                          </div>
                          <div className="text-lg font-bold text-yellow-700 dark:text-yellow-300">
                            {stat.enProceso}
                          </div>
                        </div>
                        <div className="min-w-0 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded p-2 text-center">
                          <div className="text-xs text-green-600 dark:text-green-400 font-medium whitespace-nowrap">
                            Inventariados
                          </div>
                          <div className="text-lg font-bold text-green-700 dark:text-green-300">
                            {stat.inventariado}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8 border rounded-md">
                  <Users className="mx-auto h-10 w-10 opacity-20 mb-2" />
                  No hay inventariadores con activos en este inmueble.
                </div>
              )}

              {pendientes.length > 0 && (
                <div className="flex-1 min-h-0 rounded-md border shadow-sm flex flex-col overflow-hidden">
                  <div className="px-4 py-3 bg-red-50 dark:bg-red-950/20 border-b">
                    <span className="text-sm font-bold text-red-600 dark:text-red-400">
                      ACTIVOS POR INVENTARIAR ({pendientes.length})
                    </span>
                  </div>
                  <div className="flex-1 overflow-auto">
                    <div className="min-w-max">
                      <Table>
                        <TableHeader className="bg-muted/50 sticky top-0">
                          <TableRow>
                            <TableHead className="w-[90px]">Código</TableHead>
                            <TableHead className="w-[110px]">Rubro</TableHead>
                            <TableHead className="w-[110px]">Tipo Rubro</TableHead>
                            <TableHead className="w-[200px]">Descripción</TableHead>
                            <TableHead className="w-[180px]">Ambiente</TableHead>
                            <TableHead className="w-[150px]">Responsable</TableHead>
                            <TableHead className="w-[90px]">CI Responsable</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendientesPageData.map((a, i) => {
                            const trId = a.tipoRubroAct || a.tiporubroact;
                            const rubro = (rubroFromTipo[trId] || "").trim();
                            const tipo = (tipoRubroDescMap[trId] || "").trim();
                            const codBase = (a.codigoActivo ?? a.codigoactivo ?? "").toString().trim();
                            const codigo = codBase ? `OJ-02-${codBase}` : "—";
                            const ambiente = getAmbienteName(String(a.codigoAmbiente ?? "").trim());
const respName = getResponsableName(a.cirun);
                            return (
                              <TableRow key={i}>
                                <TableCell className="font-mono text-xs">{codigo}</TableCell>
                                <TableCell className="text-xs whitespace-normal break-words max-w-[110px]">{rubro}</TableCell>
                                <TableCell className="text-xs whitespace-normal break-words max-w-[110px]">{tipo}</TableCell>
                                <TableCell className="text-xs whitespace-normal break-words max-w-[200px]">
                                  {a.descripcionActivo || "—"}
                                </TableCell>
                                <TableCell className="text-xs whitespace-normal break-words max-w-[180px]">{ambiente}</TableCell>
                                <TableCell className="text-xs whitespace-normal break-words max-w-[150px]">{respName}</TableCell>
                                <TableCell className="font-mono text-xs">{a.cirun || "—"}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/20">
                    <span className="text-xs text-muted-foreground">
                      Mostrando {pendientesPageData.length} de {pendientes.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setPendientesPage((p) => Math.max(1, p - 1))
                        }
                        disabled={pendientesPage <= 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-xs font-medium">
                        {pendientesPage} / {pendientesTotalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setPendientesPage((p) =>
                            Math.min(pendientesTotalPages, p + 1),
                          )
                        }
                        disabled={pendientesPage >= pendientesTotalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-end px-4 py-3 border-t bg-muted/20">
                    <Button
                      onClick={handleGenerarPdf}
                      disabled={isGeneratingPdf}
                    >
                      {isGeneratingPdf ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <FileDown className="h-4 w-4 mr-2" />
                      )}
                      Reporte Activos No Inventariados en PDF
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InventarioInmuebleModal;
