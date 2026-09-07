import { useCallback, useEffect, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";


import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Printer, Download, Barcode, QrCode, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
import LoadingSpinner from "@/components/ui/loading-spinner";

import {
  addActivoFijo,
  updateActivoFijo,
  deleteActivoFijo,
  fetchActivosFijosPaginated,
} from "@/store/activosFijos/activosFijosThunks";
import {
  selectActivosFijos,
  selectActivosFijosTotalCount,
  selectActivosFijosLoading,
  selectActivosFijosError,
  resetActivosFijos,
} from "@/store/activosFijos/activosFijosSlice";

import ActivosFijosForm from "./ActivosFijosForm";
import ActivosFijosFilters from "../components/ActivosFijosFilters";
import ActivosFijosTable from "../components/ActivosFijosTable";

import { useCatalogos } from "@/hooks/useCatalogos";
import { useBarcodeQR } from "../hooks/useBarcodeQR";
import { useActivosFijosCatalogs } from "../hooks/useActivosFijosCatalogs";
import { useCrudModal } from "@/hooks/useCrudModal";
import { useActivosFijosState } from "../hooks/useActivosFijosState";
import { supabase } from "@/lib/supabase";
import { toCamelCaseArray } from "@/lib/mapFields";
import { resolveAmbienteCodes } from "@/lib/ubicacionFilters";

const formatCodigoActivo = (a) =>
  a?.codigoActivo != null ? `OJ-02-${a.codigoActivo}` : "";

const ActivosFijosList = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();

  const activosFijos = useSelector(selectActivosFijos);
  const totalCount = useSelector(selectActivosFijosTotalCount);
  const isActivosLoading = useSelector(selectActivosFijosLoading);
  const error = useSelector(selectActivosFijosError);

  const {
    rubros,
    tipoRubros,
    ambientes,
    ambienteNivel,
    inmuebles,
    niveles,
    ciudades,
    responsables,
    isLoading: isLoadingCatalogos
  } = useCatalogos({
    loadRubros: true,
    loadTipoRubros: true,
    loadAmbientes: true,
    loadInmuebles: true,
    loadNiveles: true,
    loadCiudades: true,
    loadResponsables: true,
  });

  const {
    isFormOpen,
    setIsFormOpen,
    editingItem: editingActivo,
    handleAdd,
    handleEdit,
    handleCancelForm: handleCancel,

    itemToDelete: activoToDelete,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    handleDelete,
    handleCancelDelete,
  } = useCrudModal();

  const {
    filters,
    appliedFilters,
    currentPage,
    pageSize,
    handlePageChange,
    handlePageSizeChange,
    handleFilterChange,
    handleSearch,
    clearFilters
  } = useActivosFijosState({ rubroToTipoIds: {} }); // We will update rubroToTipoIds below

  const {
    rubroMap,
    ambienteMap,
    ambienteNivelMap,
    nivelMap,
    nivelInmuebleMap,
    inmuebleMap,
    inmuebleCiudadMap,
    ciudadMap,
    tipoRubroMap,
    rubroOptions,
    ciudadOptions,
    inmuebleOptionsByCiudad,
    nivelOptionsByInmueble,
    ambienteOptionsByNivel,
    rubroToTipoIds,
  } = useActivosFijosCatalogs({
    rubros,
    tipoRubros,
    ambientes,
    ambienteNivel,
    inmuebles,
    niveles,
    ciudades,
    filters,
  });

  const {
    barcodeActivo,
    setBarcodeActivo,
    qrActivo,
    setQrActivo,
    barcodeDataUrl,
    qrDataUrl,
    isQrPrintOpen,
    setIsQrPrintOpen,
    qrLabels,
    isGeneratingQrs,
    printBarcodePDF,
    printQRPDF,
    handlePrintQRs,
    printQRLabels,
    downloadQRsPDF,
  } = useBarcodeQR({ rubroMap, tipoRubroMap, activosFijos, appliedFilters, rubroToTipoIds });
  const hasSearchCriteria = Object.values(appliedFilters).some(
    (v) => String(v ?? "").trim().length > 0
  );

  const responsableMap = useMemo(() => {
    const map = {};
    (responsables || []).forEach((r) => {
      const fullName = `${r.nombre1 || ""} ${r.nombre2 || ""} ${r.paterno || ""} ${r.materno || ""}`.replace(/\s+/g, " ").trim();
      map[String(r.cirun).trim()] = fullName;
      map[String(r.cirun).trim().toUpperCase()] = fullName;
    });
    return map;
  }, [responsables]);

  const activosOrdenados = useMemo(() => {
    return [...activosFijos].sort((a, b) => {
      const tipoA = a.tiporubroact ?? a.tipoRubroAct ?? "";
      const tipoB = b.tiporubroact ?? b.tipoRubroAct ?? "";
      const rubroA = rubroMap[tipoA] ?? rubroMap[String(tipoA)] ?? String(tipoA);
      const rubroB = rubroMap[tipoB] ?? rubroMap[String(tipoB)] ?? String(tipoB);
      const rubroCmp = String(rubroA).localeCompare(String(rubroB), "es", { numeric: true, sensitivity: "base" });
      if (rubroCmp !== 0) return rubroCmp;
      const tipoStrA = tipoRubroMap[tipoA] ?? tipoRubroMap[String(tipoA)] ?? String(tipoA);
      const tipoStrB = tipoRubroMap[tipoB] ?? tipoRubroMap[String(tipoB)] ?? String(tipoB);
      const tipoCmp = String(tipoStrA).localeCompare(String(tipoStrB), "es", { numeric: true, sensitivity: "base" });
      if (tipoCmp !== 0) return tipoCmp;
      const codA = a.codigoActivo ?? a.codigoactivo ?? a.codigoactivo ?? 0;
      const codB = b.codigoActivo ?? b.codigoactivo ?? b.codigoactivo ?? 0;
      const numA = Number(codA);
      const numB = Number(codB);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return String(codA).localeCompare(String(codB), "es", { numeric: true });
    });
  }, [activosFijos, rubroMap, tipoRubroMap]);

  const handleExportExcel = useCallback(async () => {
    // Requiere al menos un filtro de ubicación para reporte completo por ambiente
    if (!appliedFilters.ambiente && !appliedFilters.nivel && !appliedFilters.inmueble && !appliedFilters.ciudad) {
      if (!activosFijos.length) {
        toast({ title: "Sin datos", description: "Seleccione un ambiente para exportar el reporte completo.", variant: "destructive" });
        return;
      }
      // Si no hay ambiente seleccionado pero hay lista paginada, se exportará la lista actual paginada filtrada (fallback)
    }
    try {
      toast({ title: "Generando Excel...", description: "Obteniendo todos los activos del ambiente seleccionado." });
      // Construir filtros igual que en thunk pero sin paginación
      const exportFilters = {
        search: appliedFilters.search,
        carnet: appliedFilters.carnet,
        rubro: appliedFilters.rubro ? rubroToTipoIds[appliedFilters.rubro] || [] : undefined,
        ambiente: appliedFilters.ambiente || undefined,
        nivel: appliedFilters.nivel || undefined,
        inmueble: appliedFilters.inmueble || undefined,
        ciudad: appliedFilters.ciudad || undefined,
      };

      // Resolver códigos de ambiente si hay filtro por nivel/inmueble/ciudad
      let ambienteCodes = null;
      if (!exportFilters.ambiente && (exportFilters.nivel || exportFilters.inmueble || exportFilters.ciudad)) {
        ambienteCodes = await resolveAmbienteCodes({
          ciudad: exportFilters.ciudad,
          inmueble: exportFilters.inmueble,
          nivel: exportFilters.nivel,
        });
      }

      const CHUNK = 1000;
      let from = 0;
      let allData = [];

      while (true) {
        let query = supabase
          .from("act_activos")
          .select("*")
          .eq("ultimoregistro", 1)
          .order("tiporubroact", { ascending: true, nullsFirst: true })
          .order("codigoactivo", { ascending: true, nullsFirst: true })
          .order("codigoactivointerno", { ascending: true })
          .range(from, from + CHUNK - 1);

        if (exportFilters.search) {
          const s = exportFilters.search.replace(/%/g, "").trim();
          if (s) {
            const searchNum = Number(s);
            if (!isNaN(searchNum)) {
              query = query.or(`codigoactivo.eq.${searchNum},cirun.ilike.%${s}%`);
            } else {
              const words = s.split(/\s+/).filter(Boolean);
              words.forEach((word) => {
                query = query.or(`descripcionactivo.ilike.%${word}%,cirun.ilike.%${word}%`);
              });
            }
          }
        }
        if (exportFilters.carnet) {
          const c = exportFilters.carnet.replace(/%/g, "").trim();
          if (c) {
            const words = c.split(/\s+/).filter(Boolean);
            words.forEach((word) => {
              query = query.ilike("cirun", `%${word}%`);
            });
          }
        }
        if (exportFilters.rubro && Array.isArray(exportFilters.rubro)) {
          query = query.in("tiporubroact", exportFilters.rubro.length > 0 ? exportFilters.rubro : [-1]);
        }
        if (exportFilters.ambiente) {
          query = query.eq("codigoambiente", exportFilters.ambiente);
        } else if (ambienteCodes) {
          query = query.in("codigoambiente", ambienteCodes && ambienteCodes.length > 0 ? ambienteCodes : [-1]);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData = allData.concat(toCamelCaseArray(data));
        if (data.length < CHUNK) break;
        from += CHUNK;
        // Seguridad para no loop infinito
        if (from > 100000) break;
      }

      if (!allData.length) {
        toast({ title: "Sin datos", description: "No se encontraron activos para el ambiente seleccionado.", variant: "destructive" });
        return;
      }

      // Usar allData en lugar de activosFijos paginados
      const headers = [
        "N°",
        "Responsable",
        "CI Responsable",
        "Código",
        "Rubro",
        "Tipo",
        "Denominación",
        "Valor Actual",
        "Ciudad",
        "Inmueble",
        "Nivel",
        "Ambiente",
        "Estado",
        "Estado Inventario",
      ];

      const resolveCiudad = (a) => {
        const amb = String(a.codigoAmbiente ?? a.codigoambiente ?? "").trim();
        if (!amb) return "";
        const codNivel = ambienteNivelMap[amb];
        if (!codNivel) return "";
        const codInmueble = nivelInmuebleMap[String(codNivel).trim()];
        if (!codInmueble) return "";
        const codCiudad = inmuebleCiudadMap[String(codInmueble).trim()];
        if (!codCiudad) return "";
        return ciudadMap[String(codCiudad).trim()] || "";
      };
      const resolveInmueble = (a) => {
        const amb = String(a.codigoAmbiente ?? a.codigoambiente ?? "").trim();
        if (!amb) return "";
        const codNivel = ambienteNivelMap[amb];
        if (!codNivel) return "";
        const codInmueble = nivelInmuebleMap[String(codNivel).trim()];
        if (!codInmueble) return "";
        return inmuebleMap[String(codInmueble).trim()] || "";
      };
      const resolveNivel = (a) => {
        const amb = String(a.codigoAmbiente ?? a.codigoambiente ?? "").trim();
        if (!amb) return "";
        const codNivel = ambienteNivelMap[amb];
        return codNivel ? (nivelMap[String(codNivel).trim()] || "") : "";
      };
      const resolveAmbiente = (a) => {
        return ambienteMap[String(a.codigoAmbiente ?? a.codigoambiente ?? "").trim()] || "";
      };

      const sortedActivos = [...allData].sort((a, b) => {
        const tipoA = a.tiporubroact ?? a.tipoRubroAct ?? "";
        const tipoB = b.tiporubroact ?? b.tipoRubroAct ?? "";
        const rubroA = rubroMap[tipoA] ?? rubroMap[String(tipoA)] ?? String(tipoA);
        const rubroB = rubroMap[tipoB] ?? rubroMap[String(tipoB)] ?? String(tipoB);
        const rubroCmp = String(rubroA).localeCompare(String(rubroB), "es", { numeric: true, sensitivity: "base" });
        if (rubroCmp !== 0) return rubroCmp;
        const tipoStrA = tipoRubroMap[tipoA] ?? tipoRubroMap[String(tipoA)] ?? String(tipoA);
        const tipoStrB = tipoRubroMap[tipoB] ?? tipoRubroMap[String(tipoB)] ?? String(tipoB);
        const tipoCmp = String(tipoStrA).localeCompare(String(tipoStrB), "es", { numeric: true, sensitivity: "base" });
        if (tipoCmp !== 0) return tipoCmp;
        const codA = a.codigoActivo ?? a.codigoactivo ?? 0;
        const codB = b.codigoActivo ?? b.codigoactivo ?? 0;
        const numA = Number(codA);
        const numB = Number(codB);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return String(codA).localeCompare(String(codB), "es", { numeric: true });
      });

      const dataRows = sortedActivos.map((a, idx) => {
        const ci = String(a.cirun || "").trim();
        const responsable = responsableMap[ci] || responsableMap[ci.toUpperCase()] || "";
        const codigo = a.codigoActivo != null ? `OJ-02-${a.codigoActivo}` : "";
        const rubro = rubroMap[a.tiporubroact] ?? rubroMap[a.tipoRubroAct] ?? "";
        const tipo = tipoRubroMap[a.tiporubroact] ?? tipoRubroMap[a.tipoRubroAct] ?? a.tiporubroact ?? a.tipoRubroAct ?? "";
        const denominacion = a.descripcionActivo ?? a.descripcionactivo ?? "";
        const valor = a.valorActual != null ? Number(a.valorActual) : "";
        const ciudad = resolveCiudad(a);
        const inmueble = resolveInmueble(a);
        const nivel = resolveNivel(a);
        const ambiente = resolveAmbiente(a);
        const estado = a.estado === 1 ? "Activo" : a.estado === 0 ? "Inactivo" : String(a.estado ?? "");
        const estadoInv = a.estadoinventario ?? a.estadoInventario ?? "";
        return [idx + 1, responsable, ci, codigo, rubro, tipo, denominacion, valor, ciudad, inmueble, nivel, ambiente, estado, estadoInv];
      });

      const sheetData = [headers, ...dataRows];
      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      // Cabeceras en negrita + color
      const headerRange = XLSX.utils.decode_range(ws["!ref"]);
      for (let C = headerRange.s.c; C <= headerRange.e.c; ++C) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: C });
        if (!ws[cellRef]) continue;
        ws[cellRef].s = {
          font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11, name: "Calibri" },
          fill: { fgColor: { rgb: "4472C4" } },
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          border: {
            top: { style: "thin", color: { rgb: "B4C6E7" } },
            bottom: { style: "thin", color: { rgb: "B4C6E7" } },
            left: { style: "thin", color: { rgb: "B4C6E7" } },
            right: { style: "thin", color: { rgb: "B4C6E7" } },
          },
        };
      }
      // Altura de fila cabecera
      ws["!rows"] = [{ hpt: 18 }];
      // Ajustar ancho de columnas
      ws["!cols"] = [
        { wch: 6 }, // N°
        { wch: 30 }, // Responsable
        { wch: 15 }, // CI
        { wch: 14 }, // Código
        { wch: 22 }, // Rubro
        { wch: 22 }, // Tipo
        { wch: 40 }, // Denominación
        { wch: 14 }, // Valor
        { wch: 18 }, // Ciudad
        { wch: 20 }, // Inmueble
        { wch: 18 }, // Nivel
        { wch: 20 }, // Ambiente
        { wch: 12 }, // Estado
        { wch: 16 }, // Estado Inventario
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "ActivosFijos");
      const dateStr = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `ActivosFijos_${dateStr}.xlsx`);
      toast({ title: "Excel generado", description: `Se exportaron ${allData.length} activos del ambiente seleccionado.` });
    } catch (err) {
      toast({ title: "Error", description: `Fallo al generar Excel: ${err.message || "Error desconocido"}`, variant: "destructive" });
    }
  }, [appliedFilters, rubroToTipoIds, responsableMap, rubroMap, tipoRubroMap, ambienteMap, ambienteNivelMap, nivelMap, nivelInmuebleMap, inmuebleMap, inmuebleCiudadMap, ciudadMap, toast]);

  useEffect(() => {
    if (!hasSearchCriteria) {
      dispatch(resetActivosFijos());
      return;
    }
    dispatch(
      fetchActivosFijosPaginated({
        page: currentPage,
        pageSize,
        filters: {
          search: appliedFilters.search,
          carnet: appliedFilters.carnet,
          rubro: appliedFilters.rubro ? rubroToTipoIds[appliedFilters.rubro] || [] : undefined,
          ambiente: appliedFilters.ambiente || undefined,
          nivel: appliedFilters.nivel || undefined,
          inmueble: appliedFilters.inmueble || undefined,
          ciudad: appliedFilters.ciudad || undefined,
        },
      })
    );
  }, [
    currentPage,
    pageSize,
    appliedFilters,
    hasSearchCriteria,
    dispatch,
    rubroToTipoIds,
  ]);

  const confirmDelete = useCallback(() => {
    if (!activoToDelete) return;
    dispatch(deleteActivoFijo(activoToDelete.codigoActivoInterno))
      .unwrap()
      .then(() => {
        handleCancelDelete();
        toast({ title: "¡Éxito!", description: "El activo fijo se ha eliminado correctamente." });
      })
      .catch((err) => {
        toast({ title: "Error", description: `Fallo al eliminar: ${err.message || "Error desconocido"}`, variant: "destructive" });
      });
  }, [activoToDelete, dispatch, toast, handleCancelDelete]);

  const handleSubmit = useCallback(
    async (data) => {
      const action = editingActivo
        ? updateActivoFijo({ codigoActivoInterno: editingActivo.codigoActivoInterno, updatedActivoFijo: data })
        : addActivoFijo(data);
      try {
        await dispatch(action).unwrap();
        toast({ title: "¡Éxito!", description: `El activo fijo se ha ${editingActivo ? "actualizado" : "guardado"} correctamente.` });
        handleCancel();
        return true;
      } catch (err) {
        toast({ title: "Error", description: `Fallo al guardar: ${err.message || "Error desconocido"}`, variant: "destructive" });
        return false;
      }
    },
    [dispatch, editingActivo, toast, handleCancel],
  );

  if (isLoadingCatalogos && activosFijos.length === 0) return <LoadingSpinner />;
  if (error) return <div className="bg-red-600 text-white text-center p-4 rounded-lg">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Activos Fijos</h1>
          <p className="text-muted-foreground">Administra los activos fijos del sistema</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handlePrintQRs}
            disabled={isGeneratingQrs || !activosFijos.length}
            className="bg-yellow-500 text-black hover:bg-yellow-600 hover:text-black"
          >
            <Printer className="mr-2 h-4 w-4" />
            {isGeneratingQrs ? "Generando..." : "Imprimir QRs"}
          </Button>
          <Button
            variant="outline"
            onClick={handleExportExcel}
            disabled={!activosFijos.length}
            className="bg-green-600 text-white hover:bg-green-700 hover:text-white"
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Reporte del Listado en Excel
          </Button>
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogContent
              className="sm:max-w-[700px]"
              onInteractOutside={(e) => {
                e.preventDefault();
                handleCancel();
              }}
            >
              <DialogHeader>
                <DialogTitle>{editingActivo ? "Editar Activo Fijo" : "Nuevo Activo Fijo"}</DialogTitle>
                <DialogDescription>
                  {editingActivo ? "Modifica los datos del activo fijo" : "Ingresa la información del nuevo activo fijo"}
                </DialogDescription>
              </DialogHeader>
              <ActivosFijosForm
                key={editingActivo?.codigoActivoInterno ?? "nuevo"}
                activoToEdit={editingActivo}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <ActivosFijosFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onSearch={handleSearch}
        onClearFilters={clearFilters}
        rubroOptions={rubroOptions}
        ciudadOptions={ciudadOptions}
        inmuebleOptionsByCiudad={inmuebleOptionsByCiudad}
        nivelOptionsByInmueble={nivelOptionsByInmueble}
        ambienteOptionsByNivel={ambienteOptionsByNivel}
        isLoading={isActivosLoading}
      />

      <ActivosFijosTable
        activosFijos={activosOrdenados}
        isLoading={isActivosLoading}
        hasSearchCriteria={hasSearchCriteria}
        totalCount={totalCount}
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        rubroMap={rubroMap}
        tipoRubroMap={tipoRubroMap}
        ambienteMap={ambienteMap}
        ambienteNivelMap={ambienteNivelMap}
        nivelInmuebleMap={nivelInmuebleMap}
        inmuebleMap={inmuebleMap}
        inmuebleCiudadMap={inmuebleCiudadMap}
        ciudadMap={ciudadMap}
        nivelMap={nivelMap}
        onBarcode={setBarcodeActivo}
        onQr={setQrActivo}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Modals for Barcode, QR and Delete */}
      <Dialog open={!!barcodeActivo} onOpenChange={(open) => { if (!open) setBarcodeActivo(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Código de Barras</DialogTitle>
            <DialogDescription>
              Activo: {formatCodigoActivo(barcodeActivo)} — {barcodeActivo?.descripcionActivo}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {barcodeDataUrl && (
              <div className="border rounded-lg p-4 bg-white" style={{ width: 260 }}>
                <img src={barcodeDataUrl} alt="Código de barras" className="w-full" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBarcodeActivo(null)}>Cerrar</Button>
            <Button onClick={printBarcodePDF} disabled={!barcodeDataUrl}>
              <Barcode className="h-4 w-4 mr-2" />
              Descargar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!qrActivo} onOpenChange={(open) => { if (!open) setQrActivo(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Código QR</DialogTitle>
            <DialogDescription>
              Activo: {formatCodigoActivo(qrActivo)} — {qrActivo?.descripcionActivo}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrDataUrl && (
              <div className="border rounded-lg p-1 bg-white w-full max-w-[360px]">
                <img src={qrDataUrl} alt="Código QR" className="w-full" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQrActivo(null)}>Cerrar</Button>
            <Button onClick={printQRPDF} disabled={!qrDataUrl}>
              <QrCode className="h-4 w-4 mr-2" />
              Descargar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isQrPrintOpen} onOpenChange={setIsQrPrintOpen}>
        <DialogContent className="sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle>Imprimir QRs ({qrLabels.length})</DialogTitle>
            <DialogDescription>
              Etiquetas generadas a partir de la lista actual. Listas para imprimir o descargar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-auto p-1">
            {qrLabels.map((l) => (
              <div key={l.codigoActivo} className="border rounded-lg overflow-hidden bg-white">
                <img src={l.dataUrl} alt={l.codigoActivo} className="w-full" />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQrPrintOpen(false)}>Cerrar</Button>
            <Button onClick={downloadQRsPDF} disabled={!qrLabels.length}>
              <Download className="h-4 w-4 mr-2" />
              Descargar PDF
            </Button>
            <Button onClick={printQRLabels} disabled={!qrLabels.length}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Está seguro de eliminar este activo fijo?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. El activo fijo "{activoToDelete?.descripcionActivo}" será eliminado permanentemente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete}>Eliminar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ActivosFijosList;
