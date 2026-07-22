import { useState, useEffect, useCallback, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import LoadingSpinner from "@/components/ui/loading-spinner";
import DataPagination from "@/components/ui/data-pagination";
import { Plus, Edit, Trash2, Package, Filter, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import {
  fetchActivosFijos, addActivoFijo, updateActivoFijo, deleteActivoFijo,
} from "@/store/activosFijos/activosFijosThunks";
import {
  selectActivosFijos, selectActivosFijosLoading, selectActivosFijosError,
} from "@/store/activosFijos/activosFijosSlice";

import ActivosFijosForm from "./ActivosFijosForm";

const INITIAL_FILTERS = { search: "" };

const ESTADO_MAP = { 1: "Activo", 0: "Inactivo" };

const ActivosFijosList = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();
  const activosFijos = useSelector(selectActivosFijos);
  const isLoading = useSelector(selectActivosFijosLoading);
  const error = useSelector(selectActivosFijosError);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingActivo, setEditingActivo] = useState(null);
  const [activoToDelete, setActivoToDelete] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [filters, setFilters] = useState({ ...INITIAL_FILTERS });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  useEffect(() => { dispatch(fetchActivosFijos()); }, [dispatch]);

  const handleAdd = useCallback(() => { setEditingActivo(null); setIsFormOpen(true); }, []);
  const handleEdit = useCallback((a) => { setEditingActivo(a); setIsFormOpen(true); }, []);
  const handleDelete = useCallback((a) => { setActivoToDelete(a); setIsDeleteDialogOpen(true); }, []);

  const confirmDelete = useCallback(() => {
    if (activoToDelete) {
      dispatch(deleteActivoFijo(activoToDelete.codigoActivoInterno));
      setIsDeleteDialogOpen(false);
      setActivoToDelete(null);
      toast({ title: "¡Éxito!", description: "El activo fijo se ha eliminado correctamente." });
    }
  }, [activoToDelete, dispatch, toast]);

  const handleCancel = useCallback(() => { setIsFormOpen(false); setEditingActivo(null); }, []);
  const handleFilterChange = useCallback((type, value) => { setFilters(p => ({ ...p, [type]: value })); setCurrentPage(1); }, []);
  const clearFilters = useCallback(() => { setFilters({ ...INITIAL_FILTERS }); setCurrentPage(1); }, []);

  const filtered = useMemo(() =>
    activosFijos.filter(a => {
      const s = `${a.descripcionActivo || ""} ${a.codigoAmbiente || ""} ${a.cirun || ""} ${a.codigoActivoInterno || ""}`.toLowerCase();
      return !filters.search || s.includes(filters.search.toLowerCase());
    }).sort((a, b) => (a.codigoActivoInterno || 0) - (b.codigoActivoInterno || 0)), [activosFijos, filters]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / pageSize)), [filtered.length, pageSize]);
  const safeCurrentPage = useMemo(() => Math.min(currentPage, totalPages), [currentPage, totalPages]);
  const paginatedData = useMemo(() => { const start = (safeCurrentPage - 1) * pageSize; return filtered.slice(start, start + pageSize); }, [filtered, safeCurrentPage, pageSize]);

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
                {paginatedData.length > 0 ? paginatedData.map(a => (
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
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(a)} title="Editar" className="text-yellow-500 hover:text-yellow-700"><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(a)} title="Eliminar" className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      <Package className="mx-auto h-12 w-12 opacity-20 mb-2" />
                      <p className="text-lg font-medium">{filters.search ? "No se encontraron activos fijos" : "No hay activos fijos registrados"}</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {filtered.length > 0 && (
            <DataPagination
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              totalCount={filtered.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => { setPageSize(newSize); setCurrentPage(1); }}
            />
          )}
        </CardContent>
      </Card>

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
