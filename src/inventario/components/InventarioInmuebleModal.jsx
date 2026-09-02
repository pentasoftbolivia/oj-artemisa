import { useState, useMemo } from "react";
import { Building2, Users, Loader2, Search, X, ChevronLeft, ChevronRight, FileDown, Package } from "lucide-react";
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

const PAGE_SIZE = 3;

const ACTIVO_COLUMNAS = [
  { head: "Código", headClass: "w-[90px]", cellClass: "font-mono text-xs" },
  { head: "Rubro", headClass: "w-[110px]", cellClass: "text-xs whitespace-normal break-words max-w-[110px]" },
  { head: "Tipo Rubro", headClass: "w-[110px]", cellClass: "text-xs whitespace-normal break-words max-w-[110px]" },
  { head: "Descripción", headClass: "w-[200px]", cellClass: "text-xs whitespace-normal break-words max-w-[200px]" },
  { head: "Ambiente", headClass: "w-[180px]", cellClass: "text-xs whitespace-normal break-words max-w-[180px]" },
  { head: "Responsable", headClass: "w-[150px]", cellClass: "text-xs whitespace-normal break-words max-w-[150px]" },
  { head: "CI Responsable", headClass: "w-[90px]", cellClass: "font-mono text-xs" },
];

const PaginacionTabla = ({ count, mostrados, page, totalPages, onPrev, onNext }) => (
  <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-t bg-muted/20">
    <span className="text-xs text-muted-foreground">
      Mostrando {mostrados} de {count}
    </span>
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={onPrev} disabled={page <= 1}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-xs font-medium">
        {page} / {totalPages}
      </span>
      <Button variant="outline" size="sm" onClick={onNext} disabled={page >= totalPages}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  </div>
);

const TablaActivos = ({ items, mapRow }) => (
  <div className="flex-1 overflow-auto">
    <div className="min-w-max">
      <Table>
        <TableHeader className="bg-muted/50 sticky top-0">
          <TableRow>
            {ACTIVO_COLUMNAS.map((c) => (
              <TableHead key={c.head} className={c.headClass}>
                {c.head}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((a, i) => (
            <TableRow key={i}>
              {mapRow(a).map((valor, j) => (
                <TableCell key={j} className={ACTIVO_COLUMNAS[j].cellClass}>
                  {valor}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  </div>
);

const SeccionActivos = ({ titulo, tituloClass, headerClass, count, children }) => (
  <div className="rounded-md border shadow-sm flex flex-col overflow-hidden">
    <div className={`px-4 py-3 border-b ${headerClass}`}>
      <span className={`text-sm font-bold ${tituloClass}`}>
        {titulo} ({count})
      </span>
    </div>
    {children}
  </div>
);

const BarraAvance = ({ inventariado, total }) => {
  const pct = total > 0 ? (inventariado / total) * 100 : 0;
  const color =
    pct <= 50 ? "#dc2626" : pct <= 80 ? "#eab308" : "#16a34a";
  return (
    <div className="col-span-2 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
          Avance del total de activos en el inmueble
        </span>
        <span className="text-xs font-bold" style={{ color }}>
          {pct.toFixed(2)}%
        </span>
      </div>
      <div className="h-3 w-full rounded-full bg-muted overflow-hidden border border-border">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }}
          title={`${inventariado} de ${total} activos`}
        />
      </div>
    </div>
  );
};

const InventarioInmuebleModal = ({
  isOpen,
  onClose,
  ciudadOptions = [],
  inmuebleOptions = [],
  inmuebleCiudadMap = {},
  getDisplayName,
  loadInmuebleSummary,
  loadInmueblePendientes,
  loadInmuebleInventariados,
  loadInmuebleEnProceso,
  loadCiudadInmueblesStats,
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

  const [isGeneratingPdfInventariados, setIsGeneratingPdfInventariados] = useState(false);
  const [generatingUser, setGeneratingUser] = useState("");

  const [inventariadosOpen, setInventariadosOpen] = useState(false);
  const [inventariados, setInventariados] = useState([]);
  const [inventariadosPage, setInventariadosPage] = useState(1);
  const [isLoadingInventariados, setIsLoadingInventariados] = useState(false);
  const [inventariadosTitle, setInventariadosTitle] = useState("");

  const [enProcesoOpen, setEnProcesoOpen] = useState(false);
  const [enProcesoList, setEnProcesoList] = useState([]);
  const [enProcesoPage, setEnProcesoPage] = useState(1);
  const [isLoadingEnProceso, setIsLoadingEnProceso] = useState(false);
  const [enProcesoTitle, setEnProcesoTitle] = useState("");

  const [ciudadInmueblesStats, setCiudadInmueblesStats] = useState([]);
  const [isLoadingCiudadStats, setIsLoadingCiudadStats] = useState(false);

  const filteredInmuebleOptions = useMemo(() => {
    if (!ciudad) return inmuebleOptions;
    return inmuebleOptions.filter(
      (o) => inmuebleCiudadMap[String(o.value).trim()] === String(ciudad).trim(),
    );
  }, [inmuebleOptions, inmuebleCiudadMap, ciudad]);

  const pendientesTotalPages = useMemo(
    () => Math.max(1, Math.ceil(pendientes.length / PAGE_SIZE)),
    [pendientes],
  );
  const pendientesPageData = useMemo(() => {
    const start = (pendientesPage - 1) * PAGE_SIZE;
    return pendientes.slice(start, start + PAGE_SIZE);
  }, [pendientes, pendientesPage]);

  const inventariadosTotalPages = useMemo(
    () => Math.max(1, Math.ceil(inventariados.length / PAGE_SIZE)),
    [inventariados],
  );
  const inventariadosPageData = useMemo(() => {
    const start = (inventariadosPage - 1) * PAGE_SIZE;
    return inventariados.slice(start, start + PAGE_SIZE);
  }, [inventariados, inventariadosPage]);

  const enProcesoTotalPages = useMemo(
    () => Math.max(1, Math.ceil(enProcesoList.length / PAGE_SIZE)),
    [enProcesoList],
  );
  const enProcesoPageData = useMemo(() => {
    const start = (enProcesoPage - 1) * PAGE_SIZE;
    return enProcesoList.slice(start, start + PAGE_SIZE);
  }, [enProcesoList, enProcesoPage]);



  const mapActivoRow = (a) => {
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
  };

  const handleBuscar = async () => {
    setIsLoading(true);
    const shouldLoadCiudadStats = Boolean(ciudad && !inmueble && loadCiudadInmueblesStats);
    if (shouldLoadCiudadStats) setIsLoadingCiudadStats(true);
    else setCiudadInmueblesStats([]);

    const summaryPromise = loadInmuebleSummary({ ciudad, inmueble })
      .catch((e) => {
        console.error("Error loading inmueble summary:", e);
        return { totalInmueble: 0, totalInventariado: 0, totalEnProceso: 0, perUser: [] };
      });
    const pendientesPromise = loadInmueblePendientes({ ciudad, inmueble }).catch((e) => {
      console.error("Error loading pendientes:", e);
      return [];
    });
    const ciudadStatsPromise = shouldLoadCiudadStats
      ? loadCiudadInmueblesStats({ ciudad }).catch((e) => {
          console.error("Error loading ciudad inmuebles stats:", e);
          return [];
        })
      : Promise.resolve(null);

    const [data, pend, stats] = await Promise.all([summaryPromise, pendientesPromise, ciudadStatsPromise]);

    setResult(data);
    setPendientes(pend || []);
    setPendientesPage(1);
    if (shouldLoadCiudadStats) {
      setCiudadInmueblesStats(stats || []);
      setIsLoadingCiudadStats(false);
    }
    setIsLoading(false);
  };

  const handleLimpiar = () => {
    setCiudad("");
    setInmueble("");
    setResult(null);
    setPendientes([]);
    setPendientesPage(1);
    setCiudadInmueblesStats([]);
  };

  const handleClose = () => {
    handleLimpiar();
    setInventariadosOpen(false);
    setInventariados([]);
    setInventariadosPage(1);
    setInventariadosTitle("");
    setEnProcesoOpen(false);
    setEnProcesoList([]);
    setEnProcesoPage(1);
    setEnProcesoTitle("");
    setCiudadInmueblesStats([]);
    onClose();
  };

  const handleShowInventariados = async ({ usuario = "", displayName = "" } = {}) => {
    if (!result || result.totalInventariado === 0) return;
    setInventariadosTitle(
      displayName ? `Activos Inventariados — ${displayName}` : "Activos Inventariados — Todos",
    );
    setInventariados([]);
    setInventariadosPage(1);
    setInventariadosOpen(true);
    setIsLoadingInventariados(true);
    try {
      const data = await loadInmuebleInventariados({ ciudad, inmueble, usuario });
      setInventariados(data || []);
    } catch (e) {
      console.error("Error loading inventariados:", e);
      setInventariados([]);
    } finally {
      setIsLoadingInventariados(false);
    }
  };

  const handleCloseInventariados = () => {
    setInventariadosOpen(false);
    setInventariados([]);
    setInventariadosPage(1);
  };

  const handleShowEnProceso = async ({ usuario = "", displayName = "" } = {}) => {
    if (!result || result.totalEnProceso === 0) return;
    setEnProcesoTitle(
      displayName ? `Activos En Proceso — ${displayName}` : "Activos En Proceso — Todos",
    );
    setEnProcesoList([]);
    setEnProcesoPage(1);
    setEnProcesoOpen(true);
    setIsLoadingEnProceso(true);
    try {
      const data = await loadInmuebleEnProceso({ ciudad, inmueble, usuario });
      setEnProcesoList(data || []);
    } catch (e) {
      console.error("Error loading en proceso:", e);
      setEnProcesoList([]);
    } finally {
      setIsLoadingEnProceso(false);
    }
  };

  const handleCloseEnProceso = () => {
    setEnProcesoOpen(false);
    setEnProcesoList([]);
    setEnProcesoPage(1);
  };

  const handleGenerarPdfInventariados = async ({ usuario = "", displayName = "" } = {}) => {
    if (!result || result.totalInventariado === 0) return;
    if (isGeneratingPdfInventariados) return;
    setIsGeneratingPdfInventariados(true);
    setGeneratingUser(usuario || "__all__");
    try {
      const data = await loadInmuebleInventariados({ ciudad, inmueble, usuario });
      if (!data || data.length === 0) {
        console.warn("No hay activos inventariados para generar PDF");
        return;
      }
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.text("ACTIVOS INVENTARIADOS", pageWidth / 2, 15, { align: "center" });

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

      let startY;
      if (displayName) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(`INVENTARIADOR: ${displayName}`, pageWidth / 2, 25, { align: "center" });
        doc.setFontSize(8);
        doc.text(`Total de activos inventariados: ${data.length}`, pageWidth / 2, 29, { align: "center" });
        startY = 32;
      } else {
        doc.setFontSize(8);
        doc.text(`Total de activos inventariados: ${data.length}`, pageWidth / 2, 25, { align: "center" });
        startY = 28;
      }

      const body = data.map(mapActivoRow);

      autoTable(doc, {
        startY,
        head: [["Código", "Rubro", "Tipo Rubro", "Descripción", "Ambiente", "Responsable", "CI Responsable"]],
        body,
        theme: "striped",
        styles: { font: "helvetica", fontSize: 7, cellPadding: 1.2, overflow: "linebreak" },
        headStyles: { fillColor: [22, 163, 74], textColor: [255, 255, 255], halign: "center" },
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

      const safeInmueble = (selectedInmueble || "Inmueble").replace(/[^a-zA-Z0-9]+/g, "_");
      const safeUser = displayName ? `_${displayName.replace(/[^a-zA-Z0-9]+/g, "_")}` : "";
      doc.save(`Activos_Inventariados_${safeInmueble}${safeUser}.pdf`);
    } catch (e) {
      console.error("Error generando PDF inventariados:", e);
    } finally {
      setIsGeneratingPdfInventariados(false);
      setGeneratingUser("");
    }
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

      const body = pendientes.map(mapActivoRow);

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
        ...pendientes.map(mapActivoRow),
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
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="w-full max-w-[96vw] sm:max-w-[1200px] max-h-[90vh] flex flex-col p-4 sm:p-6">
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
              wrapText
            />
            <ComboboxField
              label="Inmueble"
              value={inmueble}
              onValueChange={setInmueble}
              options={filteredInmuebleOptions}
              placeholder="Seleccionar inmueble..."
              searchPlaceholder="Buscar inmueble..."
              emptyMessage="Sin resultados"
              wrapText
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
              className="ml-auto bg-sky-300 hover:bg-sky-400 text-sky-950 border-sky-400"
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
                <div
                  className={`rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20 p-4 text-center shadow-sm ${result.totalInventariado > 0 ? "cursor-pointer hover:shadow-md hover:border-green-400 transition-all" : "opacity-70"}`}
                  onClick={() => result.totalInventariado > 0 && !isGeneratingPdfInventariados && handleGenerarPdfInventariados({ usuario: "", displayName: "" })}
                  role={result.totalInventariado > 0 ? "button" : undefined}
                  tabIndex={result.totalInventariado > 0 ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && result.totalInventariado > 0) handleGenerarPdfInventariados({ usuario: "", displayName: "" });
                  }}
                  title={result.totalInventariado > 0 ? "Click para generar PDF de inventariados" : undefined}
                >
                  <div className="text-sm font-semibold text-green-600 dark:text-green-400 tracking-wide">
                    TOTAL DE ACTIVOS INVENTARIADOS
                  </div>
                  <div className="text-3xl font-bold text-green-700 dark:text-green-300">
                    {result.totalInventariado}
                  </div>
                  {result.totalInventariado > 0 && (
                    <div className="text-xs text-green-600 dark:text-green-400 mt-1 underline underline-offset-2 flex items-center justify-center gap-1">
                      {isGeneratingPdfInventariados && generatingUser === "__all__" ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" /> Generando PDF...
                        </>
                      ) : (
                        <>
                          <FileDown className="h-3 w-3" /> Ver listado
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div
                  className={`rounded-lg border border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950/20 p-4 text-center shadow-sm ${result.totalEnProceso > 0 ? "cursor-pointer hover:shadow-md hover:border-yellow-400 transition-all" : "opacity-70"}`}
                  onClick={() => result.totalEnProceso > 0 && handleShowEnProceso({ usuario: "", displayName: "" })}
                  role={result.totalEnProceso > 0 ? "button" : undefined}
                  tabIndex={result.totalEnProceso > 0 ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && result.totalEnProceso > 0) handleShowEnProceso({ usuario: "", displayName: "" });
                  }}
                  title={result.totalEnProceso > 0 ? "Click para ver listado en proceso" : undefined}
                >
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
                        <div
                          className={`min-w-0 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded p-2 text-center ${stat.enProceso > 0 ? "cursor-pointer hover:border-yellow-400 hover:shadow-sm transition-all" : "opacity-70"}`}
                          onClick={() =>
                            stat.enProceso > 0 &&
                            handleShowEnProceso({
                              usuario: stat.email,
                              displayName: getDisplayName(stat.email),
                            })
                          }
                          role={stat.enProceso > 0 ? "button" : undefined}
                          tabIndex={stat.enProceso > 0 ? 0 : undefined}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && stat.enProceso > 0)
                              handleShowEnProceso({
                                usuario: stat.email,
                                displayName: getDisplayName(stat.email),
                              });
                          }}
                          title={stat.enProceso > 0 ? "Click para ver listado en proceso" : undefined}
                        >
                          <div className="text-xs text-yellow-600 dark:text-yellow-400 font-medium whitespace-nowrap">
                            En Proceso
                          </div>
                          <div className="text-lg font-bold text-yellow-700 dark:text-yellow-300">
                            {stat.enProceso}
                          </div>
                        </div>
                        <div
                          className={`min-w-0 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded p-2 text-center ${stat.inventariado > 0 ? "cursor-pointer hover:border-green-400 hover:shadow-sm transition-all" : "opacity-70"}`}
                          onClick={() =>
                            stat.inventariado > 0 &&
                            handleShowInventariados({
                              usuario: stat.email,
                              displayName: getDisplayName(stat.email),
                            })
                          }
                          role={stat.inventariado > 0 ? "button" : undefined}
                          tabIndex={stat.inventariado > 0 ? 0 : undefined}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && stat.inventariado > 0)
                              handleShowInventariados({
                                usuario: stat.email,
                                displayName: getDisplayName(stat.email),
                              });
                          }}
                          title={stat.inventariado > 0 ? "Click para ver listado" : undefined}
                        >
                          <div className="text-xs text-green-600 dark:text-green-400 font-medium whitespace-nowrap">
                            Inventariados
                          </div>
                          <div className="text-lg font-bold text-green-700 dark:text-green-300">
                            {stat.inventariado}
                          </div>
                        </div>
                        <BarraAvance
                          inventariado={stat.inventariado}
                          total={result.totalInmueble}
                        />
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

              {ciudad && !inmueble && result && (
                <div className="space-y-3">
                  {isLoadingCiudadStats ? (
                    <div className="flex flex-col justify-center items-center py-8 border rounded-md">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground animate-pulse">
                        Cargando detalle por inmueble...
                      </p>
                    </div>
                  ) : ciudadInmueblesStats.length > 0 ? (
                    <>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-semibold tracking-wide">
                          DETALLE POR INMUEBLE — {ciudadOptions.find((o) => String(o.value).trim() === String(ciudad).trim())?.label || ciudad}
                        </span>
                        <span className="text-xs text-muted-foreground">({ciudadInmueblesStats.length} inmuebles)</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {ciudadInmueblesStats.map((stat) => (
                          <div
                            key={stat.codigoinmueble}
                            className="rounded-lg border p-4 bg-card space-y-2 shadow-sm"
                          >
                            <div className="text-sm font-semibold truncate" title={stat.inmueble}>
                              {stat.inmueble}
                            </div>
                            <div className="text-xs text-muted-foreground">Código: {stat.codigoinmueble}</div>
                            <div className="rounded bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 p-2 text-center">
                              <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">Total activos</div>
                              <div className="text-lg font-bold text-blue-700 dark:text-blue-300">{stat.totalInmueble}</div>
                            </div>
                            <BarraAvance inventariado={stat.totalInventariado} total={stat.totalInmueble} />
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              )}

              {pendientes.length > 0 && (
                <SeccionActivos
                  titulo="ACTIVOS POR INVENTARIAR"
                  count={pendientes.length}
                  tituloClass="text-red-600 dark:text-red-400"
                  headerClass="bg-red-50 dark:bg-red-950/20"
                >
                  <TablaActivos items={pendientesPageData} mapRow={mapActivoRow} />
                  <PaginacionTabla
                    count={pendientes.length}
                    mostrados={pendientesPageData.length}
                    page={pendientesPage}
                    totalPages={pendientesTotalPages}
                    onPrev={() => setPendientesPage((p) => Math.max(1, p - 1))}
                    onNext={() => setPendientesPage((p) => Math.min(pendientesTotalPages, p + 1))}
                  />
                  <div className="flex flex-wrap justify-end gap-2 px-4 py-3 border-t bg-muted/20">
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
                </SeccionActivos>
              )}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>

      <Dialog open={inventariadosOpen} onOpenChange={(open) => !open && handleCloseInventariados()}>
        <DialogContent className="w-full max-w-[96vw] sm:max-w-[1200px] max-h-[85vh] flex flex-col p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-green-600" />
              {inventariadosTitle || "Activos Inventariados"}
            </DialogTitle>
            <DialogDescription>
              {inventariados.length > 0
                ? `Mostrando ${inventariados.length} activo(s) inventariado(s) en el inmueble seleccionado.`
                : "Listado de activos con estado inventariado."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 flex flex-col">
            {isLoadingInventariados ? (
              <div className="flex flex-col justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="mt-4 text-muted-foreground animate-pulse">Cargando inventariados...</p>
              </div>
            ) : inventariados.length > 0 ? (
              <SeccionActivos
                titulo="ACTIVOS INVENTARIADOS"
                count={inventariados.length}
                tituloClass="text-green-600 dark:text-green-400"
                headerClass="bg-green-50 dark:bg-green-950/20"
              >
                <TablaActivos items={inventariadosPageData} mapRow={mapActivoRow} />
                <PaginacionTabla
                  count={inventariados.length}
                  mostrados={inventariadosPageData.length}
                  page={inventariadosPage}
                  totalPages={inventariadosTotalPages}
                  onPrev={() => setInventariadosPage((p) => Math.max(1, p - 1))}
                  onNext={() => setInventariadosPage((p) => Math.min(inventariadosTotalPages, p + 1))}
                />
              </SeccionActivos>
            ) : (
              <div className="text-center text-muted-foreground py-8 border rounded-md">
                <Package className="mx-auto h-10 w-10 opacity-20 mb-2" />
                No se encontraron activos inventariados para el filtro seleccionado.
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4">
            <Button variant="outline" onClick={handleCloseInventariados}>
              <X className="h-4 w-4 mr-2" />
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={enProcesoOpen} onOpenChange={(open) => !open && handleCloseEnProceso()}>
        <DialogContent className="w-full max-w-[96vw] sm:max-w-[1200px] max-h-[85vh] flex flex-col p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-yellow-600" />
              {enProcesoTitle || "Activos En Proceso"}
            </DialogTitle>
            <DialogDescription>
              {enProcesoList.length > 0
                ? `Mostrando ${enProcesoList.length} activo(s) en proceso en el inmueble seleccionado.`
                : "Listado de activos con estado EN PROCESO."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 flex flex-col">
            {isLoadingEnProceso ? (
              <div className="flex flex-col justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="mt-4 text-muted-foreground animate-pulse">Cargando en proceso...</p>
              </div>
            ) : enProcesoList.length > 0 ? (
              <SeccionActivos
                titulo="ACTIVOS EN PROCESO"
                count={enProcesoList.length}
                tituloClass="text-yellow-600 dark:text-yellow-400"
                headerClass="bg-yellow-50 dark:bg-yellow-950/20"
              >
                <TablaActivos items={enProcesoPageData} mapRow={mapActivoRow} />
                <PaginacionTabla
                  count={enProcesoList.length}
                  mostrados={enProcesoPageData.length}
                  page={enProcesoPage}
                  totalPages={enProcesoTotalPages}
                  onPrev={() => setEnProcesoPage((p) => Math.max(1, p - 1))}
                  onNext={() => setEnProcesoPage((p) => Math.min(enProcesoTotalPages, p + 1))}
                />
              </SeccionActivos>
            ) : (
              <div className="text-center text-muted-foreground py-8 border rounded-md">
                <Package className="mx-auto h-10 w-10 opacity-20 mb-2" />
                No se encontraron activos en proceso para el filtro seleccionado.
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4">
            <Button variant="outline" onClick={handleCloseEnProceso}>
              <X className="h-4 w-4 mr-2" />
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InventarioInmuebleModal;
