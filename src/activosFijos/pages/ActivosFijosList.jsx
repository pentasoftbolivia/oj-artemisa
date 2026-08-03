import { useState, useEffect, useCallback, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";


import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Printer, Download, Barcode, QrCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import LoadingSpinner from "@/components/ui/loading-spinner";

import {
  fetchActivosFijosPaginated,
  addActivoFijo,
  updateActivoFijo,
  deleteActivoFijo,
} from "@/store/activosFijos/activosFijosThunks";
import {
  selectActivosFijos,
  selectActivosFijosTotalCount,
  selectActivosFijosLoading,
  selectActivosFijosError,
} from "@/store/activosFijos/activosFijosSlice";

import ActivosFijosForm from "./ActivosFijosForm";
import ActivosFijosFilters from "../components/ActivosFijosFilters";
import ActivosFijosTable from "../components/ActivosFijosTable";

import { useCatalogos } from "@/hooks/useCatalogos";
import { useBarcodeQR } from "../hooks/useBarcodeQR";
import { useActivosFijosCatalogs } from "../hooks/useActivosFijosCatalogs";

const INITIAL_FILTERS = { search: "", rubro: "", carnet: "", ciudad: "", ambiente: "", inmueble: "", nivel: "" };
const DEBOUNCE_MS = 300;

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
    isLoading: isLoadingCatalogos
  } = useCatalogos({
    loadRubros: true,
    loadTipoRubros: true,
    loadAmbientes: true,
    loadInmuebles: true,
    loadNiveles: true,
    loadCiudades: true,
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingActivo, setEditingActivo] = useState(null);
  const [activoToDelete, setActivoToDelete] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const [filters, setFilters] = useState({ ...INITIAL_FILTERS });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debouncedCarnet, setDebouncedCarnet] = useState("");
  
  const isFirstRender = useRef(true);
  const debounceTimer = useRef(null);

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
  } = useBarcodeQR({ rubroMap, tipoRubroMap, activosFijos });

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setDebouncedSearch(filters.search);
      setDebouncedCarnet(filters.carnet);
      return;
    }
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(filters.search);
      setDebouncedCarnet(filters.carnet);
      setCurrentPage(1);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [filters.search, filters.carnet]);

  useEffect(() => {
    dispatch(
      fetchActivosFijosPaginated({
        page: currentPage,
        pageSize,
        filters: {
          search: debouncedSearch,
          carnet: debouncedCarnet,
          rubro: filters.rubro ? rubroToTipoIds[filters.rubro] || [] : undefined,
          ambiente: filters.ambiente || undefined,
          nivel: filters.nivel || undefined,
          inmueble: filters.inmueble || undefined,
          ciudad: filters.ciudad || undefined,
        },
      }),
    );
  }, [
    currentPage,
    pageSize,
    debouncedSearch,
    debouncedCarnet,
    filters.rubro,
    filters.ambiente,
    filters.nivel,
    filters.inmueble,
    filters.ciudad,
    dispatch,
    rubroToTipoIds,
  ]);

  const handlePageChange = useCallback((page) => setCurrentPage(page), []);
  const handlePageSizeChange = useCallback((newSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
  }, []);

  const handleAdd = useCallback(() => {
    setEditingActivo(null);
    setIsFormOpen(true);
  }, []);
  
  const handleEdit = useCallback((a) => {
    setEditingActivo(a);
    setIsFormOpen(true);
  }, []);
  
  const handleDelete = useCallback((a) => {
    setActivoToDelete(a);
    setIsDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!activoToDelete) return;
    dispatch(deleteActivoFijo(activoToDelete.codigoActivoInterno))
      .unwrap()
      .then(() => {
        setIsDeleteDialogOpen(false);
        setActivoToDelete(null);
        toast({ title: "¡Éxito!", description: "El activo fijo se ha eliminado correctamente." });
      })
      .catch((err) => {
        toast({ title: "Error", description: `Fallo al eliminar: ${err.message || "Error desconocido"}`, variant: "destructive" });
      });
  }, [activoToDelete, dispatch, toast]);

  const handleCancel = useCallback(() => {
    setIsFormOpen(false);
    setEditingActivo(null);
  }, []);

  const handleFilterChange = useCallback((type, value) => {
    setFilters((p) => {
      const next = { ...p, [type]: value };
      if (type === "ciudad") {
        next.inmueble = "";
        next.nivel = "";
        next.ambiente = "";
      } else if (type === "inmueble") {
        next.nivel = "";
        next.ambiente = "";
      } else if (type === "nivel") {
        next.ambiente = "";
      }
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ ...INITIAL_FILTERS });
    setDebouncedSearch("");
    setDebouncedCarnet("");
    setCurrentPage(1);
    isFirstRender.current = true;
  }, []);

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

  if ((isActivosLoading || isLoadingCatalogos) && activosFijos.length === 0) return <LoadingSpinner />;
  if (error) return <div className="bg-red-600 text-white text-center p-4 rounded-lg">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Activos Fijos</h1>
          <p className="text-muted-foreground">Administra los activos fijos del sistema</p>
        </div>
        <div className="flex items-center gap-2">
          {(filters.ciudad || filters.inmueble || filters.nivel || filters.ambiente) && (
            <Button
              variant="outline"
              onClick={handlePrintQRs}
              disabled={isGeneratingQrs || !activosFijos.length}
              className="bg-yellow-500 text-black hover:bg-yellow-600 hover:text-black"
            >
              <Printer className="mr-2 h-4 w-4" />
              {isGeneratingQrs ? "Generando..." : "Imprimir QRs"}
            </Button>
          )}
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleAdd}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo
              </Button>
            </DialogTrigger>
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
        onClearFilters={clearFilters}
        rubroOptions={rubroOptions}
        ciudadOptions={ciudadOptions}
        inmuebleOptionsByCiudad={inmuebleOptionsByCiudad}
        nivelOptionsByInmueble={nivelOptionsByInmueble}
        ambienteOptionsByNivel={ambienteOptionsByNivel}
      />

      <ActivosFijosTable
        activosFijos={activosFijos}
        isLoading={isActivosLoading}
        filters={filters}
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
