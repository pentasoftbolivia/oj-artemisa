import { useState, useEffect, useCallback, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import LoadingSpinner from "@/components/ui/loading-spinner";
import DataPagination from "@/components/ui/data-pagination";
import { Plus, Edit, Trash2, Package, Filter, X, Barcode, QrCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";

import {
  fetchActivosFijosPaginated, addActivoFijo, updateActivoFijo, deleteActivoFijo,
} from "@/store/activosFijos/activosFijosThunks";
import {
  selectActivosFijos, selectActivosFijosTotalCount, selectActivosFijosLoading, selectActivosFijosError,
} from "@/store/activosFijos/activosFijosSlice";

import ActivosFijosForm from "./ActivosFijosForm";

const INITIAL_FILTERS = { search: "" };
const ESTADO_MAP = { 1: "Activo", 0: "Inactivo" };
const DEBOUNCE_MS = 300;

const ActivosFijosList = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();
  const activosFijos = useSelector(selectActivosFijos);
  const totalCount = useSelector(selectActivosFijosTotalCount);
  const isLoading = useSelector(selectActivosFijosLoading);
  const error = useSelector(selectActivosFijosError);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingActivo, setEditingActivo] = useState(null);
  const [activoToDelete, setActivoToDelete] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [filters, setFilters] = useState({ ...INITIAL_FILTERS });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const isFirstRender = useRef(true);
  const debounceTimer = useRef(null);

  const [barcodeActivo, setBarcodeActivo] = useState(null);
  const [qrActivo, setQrActivo] = useState(null);
  const [barcodeDataUrl, setBarcodeDataUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setDebouncedSearch(filters.search);
      return;
    }
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(filters.search);
      setCurrentPage(1);
    }, DEBOUNCE_MS);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [filters.search]);

  useEffect(() => {
    dispatch(fetchActivosFijosPaginated({ page: currentPage, pageSize, filters: { search: debouncedSearch } }));
  }, [currentPage, pageSize, debouncedSearch, dispatch]);

  useEffect(() => {
    if (!barcodeActivo) return;
    const canvas = document.createElement("canvas");
    JsBarcode(canvas, String(barcodeActivo.codigoActivoInterno), {
      format: "CODE128", width: 1.5, height: 40, displayValue: true, fontSize: 12, margin: 5,
    });
    setBarcodeDataUrl(canvas.toDataURL("image/png"));
  }, [barcodeActivo]);

  useEffect(() => {
    if (!qrActivo) return;
    const content = `${qrActivo.tipoRubroAct || ""}|${qrActivo.codigoActivoInterno || ""}|${qrActivo.descripcionActivo || ""}`;
    QRCode.toDataURL(content, { width: 180, margin: 1 }).then(setQrDataUrl);
  }, [qrActivo]);

  const printBarcodePDF = useCallback(() => {
    if (!barcodeDataUrl || !barcodeActivo) return;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [50, 25] });
    doc.addImage(barcodeDataUrl, "PNG", 3, 3, 44, 14);
    doc.setFontSize(8);
    doc.text(String(barcodeActivo.codigoActivoInterno), 25, 21, { align: "center" });
    doc.save(`codigo-barras-${barcodeActivo.codigoActivoInterno}.pdf`);
  }, [barcodeDataUrl, barcodeActivo]);

  const printQRPDF = useCallback(() => {
    if (!qrDataUrl || !qrActivo) return;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [50, 25] });
    doc.addImage(qrDataUrl, "PNG", 2, 2, 21, 21);
    doc.setFontSize(7);
    doc.text(`Tipo: ${qrActivo.tipoRubroAct || ""}`, 27, 7);
    doc.text(`Cod: ${String(qrActivo.codigoActivoInterno) || ""}`, 27, 12);
    doc.text(qrActivo.descripcionActivo || "", 27, 20, { maxWidth: 21 });
    doc.save(`codigo-qr-${qrActivo.codigoActivoInterno}.pdf`);
  }, [qrDataUrl, qrActivo]);

  const handlePageChange = useCallback((page) => { setCurrentPage(page); }, []);
  const handlePageSizeChange = useCallback((newSize) => { setPageSize(newSize); setCurrentPage(1); }, []);

  const handleAdd = useCallback(() => { setEditingActivo(null); setIsFormOpen(true); }, []);
  const handleEdit = useCallback((a) => { setEditingActivo(a); setIsFormOpen(true); }, []);
  const handleDelete = useCallback((a) => { setActivoToDelete(a); setIsDeleteDialogOpen(true); }, []);

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

  const handleCancel = useCallback(() => { setIsFormOpen(false); setEditingActivo(null); }, []);
  const handleFilterChange = useCallback((type, value) => { setFilters(p => ({ ...p, [type]: value })); }, []);

  const clearFilters = useCallback(() => {
    setFilters({ ...INITIAL_FILTERS });
    setDebouncedSearch("");
    setCurrentPage(1);
    isFirstRender.current = true;
  }, []);

  const handleSubmit = useCallback(async (data) => {
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
  }, [dispatch, editingActivo, toast, handleCancel]);

  if (isLoading && activosFijos.length === 0) return <LoadingSpinner />;
  if (error) return <div className="bg-red-600 text-white text-center p-4 rounded-lg">Error: {error}</div>;

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Activos Fijos</h1>
          <p className="text-muted-foreground">Administra los activos fijos del sistema</p>
        </div>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAdd}><Plus className="mr-2 h-4 w-4" />Nuevo</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px]" onInteractOutside={(e) => { e.preventDefault(); handleCancel(); }}>
            <DialogHeader>
              <DialogTitle>{editingActivo ? "Editar Activo Fijo" : "Nuevo Activo Fijo"}</DialogTitle>
              <DialogDescription>{editingActivo ? "Modifica los datos del activo fijo" : "Ingresa la información del nuevo activo fijo"}</DialogDescription>
            </DialogHeader>
            <ActivosFijosForm activoToEdit={editingActivo} onSubmit={handleSubmit} onCancel={handleCancel} />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Filter className="h-4 w-4" />Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Buscar</Label>
              <Input id="search" placeholder="Descripción, ambiente, CI funcionario o código..." value={filters.search} onChange={(e) => handleFilterChange("search", e.target.value)} />
            </div>
            <div className="space-y-2 flex items-end">
              <Button variant="outline" size="sm" onClick={clearFilters} className="w-full" disabled={!filters.search}>
                <X className="mr-2 h-4 w-4" />Limpiar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Package className="h-4 w-4" />Lista de Activos Fijos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código Interno</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Ambiente</TableHead>
                  <TableHead>CI Funcionario</TableHead>
                  <TableHead>Tipo Rubro</TableHead>
                  <TableHead>Valor Actual</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activosFijos.length > 0 ? activosFijos.map(a => (
                  <TableRow key={a.codigoActivoInterno}>
                    <TableCell className="font-mono text-xs">{a.codigoActivoInterno}</TableCell>
                    <TableCell className="whitespace-normal break-words max-w-[250px]">{a.descripcionActivo}</TableCell>
                    <TableCell className="font-mono text-xs">{a.codigoAmbiente || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{a.cirun || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{a.tipoRubroAct != null ? a.tipoRubroAct : "—"}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{a.valorActual != null ? `Bs ${Number(a.valorActual).toFixed(2)}` : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={a.estado === 1 ? "default" : "secondary"}>
                        {ESTADO_MAP[a.estado] || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex space-x-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => setBarcodeActivo(a)} title="Código de barras" className="text-green-600 hover:text-green-800"><Barcode className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => setQrActivo(a)} title="Código QR" className="text-purple-600 hover:text-purple-800"><QrCode className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(a)} title="Editar" className="text-yellow-500 hover:text-yellow-700"><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(a)} title="Eliminar" className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      <Package className="mx-auto h-12 w-12 opacity-20 mb-2" />
                      <p className="text-lg font-medium">{isLoading ? "Cargando..." : filters.search ? "No se encontraron activos fijos" : "No hay activos fijos registrados"}</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {totalCount > 0 && (
            <DataPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={!!barcodeActivo} onOpenChange={(open) => { if (!open) setBarcodeActivo(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Código de Barras</DialogTitle>
            <DialogDescription>
              Activo: {barcodeActivo?.codigoActivoInterno} — {barcodeActivo?.descripcionActivo}
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
              Activo: {qrActivo?.codigoActivoInterno} — {qrActivo?.descripcionActivo}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrDataUrl && (
              <div className="border rounded-lg p-4 bg-white" style={{ width: 220 }}>
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

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Está seguro de eliminar este activo fijo?</DialogTitle>
            <DialogDescription>Esta acción no se puede deshacer. El activo fijo "{activoToDelete?.descripcionActivo}" será eliminado permanentemente.</DialogDescription>
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
