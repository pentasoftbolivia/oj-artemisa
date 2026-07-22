import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import LoadingSpinner from "@/components/ui/loading-spinner";
import DataPagination from "@/components/ui/data-pagination";
import { Plus, Edit, Trash2, Building2, Filter, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import {
  fetchInmuebles,
  addInmueble,
  updateInmueble,
  deleteInmueble,
} from "@/store/inmueble/inmuebleThunks";
import {
  selectInmuebles,
  selectInmueblesLoading,
  selectInmueblesError,
} from "@/store/inmueble/inmuebleSlice";
import InmuebleForm from "./InmuebleForm";

const INITIAL_FILTERS = { search: "" };
const ESTADO_MAP = { 1: "Activo", 0: "Inactivo" };

const InmuebleList = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();
  const inmuebles = useSelector(selectInmuebles);
  const isLoading = useSelector(selectInmueblesLoading);
  const error = useSelector(selectInmueblesError);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingInmueble, setEditingInmueble] = useState(null);
  const [inmuebleToDelete, setInmuebleToDelete] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [filters, setFilters] = useState({ ...INITIAL_FILTERS });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  useEffect(() => { dispatch(fetchInmuebles()); }, [dispatch]);

  const handleAdd = useCallback(() => { setEditingInmueble(null); setIsFormOpen(true); }, []);
  const handleEdit = useCallback((a) => { setEditingInmueble(a); setIsFormOpen(true); }, []);
  const handleDelete = useCallback((a) => { setInmuebleToDelete(a); setIsDeleteDialogOpen(true); }, []);

  const confirmDelete = useCallback(() => {
    if (inmuebleToDelete) {
      dispatch(deleteInmueble(inmuebleToDelete.codigoinmueble));
      setIsDeleteDialogOpen(false);
      setInmuebleToDelete(null);
      toast({ title: "¡Éxito!", description: "El inmueble se ha eliminado correctamente." });
    }
  }, [inmuebleToDelete, dispatch, toast]);

  const handleCancel = useCallback(() => { setIsFormOpen(false); setEditingInmueble(null); }, []);
  const handleFilterChange = useCallback((type, value) => { setFilters(p => ({ ...p, [type]: value })); setCurrentPage(1); }, []);
  const clearFilters = useCallback(() => { setFilters({ ...INITIAL_FILTERS }); setCurrentPage(1); }, []);

  const filtered = useMemo(() =>
    inmuebles.filter(a => {
      const s = `${a.inmueble || ""} ${a.codigoinmueble || ""}`.toLowerCase();
      return !filters.search || s.includes(filters.search.toLowerCase());
    }).sort((a, b) => (a.inmueble || "").localeCompare(b.inmueble || "")), [inmuebles, filters]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / pageSize)), [filtered.length, pageSize]);
  const safeCurrentPage = useMemo(() => Math.min(currentPage, totalPages), [currentPage, totalPages]);
  const paginatedData = useMemo(() => { const start = (safeCurrentPage - 1) * pageSize; return filtered.slice(start, start + pageSize); }, [filtered, safeCurrentPage, pageSize]);

  const handleSubmit = useCallback(async (data) => {
    const action = editingInmueble
      ? updateInmueble({ codigoinmueble: editingInmueble.codigoinmueble, updatedInmueble: data })
      : addInmueble(data);
    try {
      await dispatch(action).unwrap();
      toast({ title: "¡Éxito!", description: `El inmueble se ha ${editingInmueble ? "actualizado" : "guardado"} correctamente.` });
      handleCancel();
      return true;
    } catch (err) {
      toast({ title: "Error", description: `Fallo al guardar: ${err.message || "Error desconocido"}`, variant: "destructive" });
      return false;
    }
  }, [dispatch, editingInmueble, toast, handleCancel]);

  if (isLoading && inmuebles.length === 0) return <LoadingSpinner />;
  if (error) return <div className="bg-red-600 text-white text-center p-4 rounded-lg">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inmuebles</h1>
          <p className="text-muted-foreground">Administra los inmuebles del sistema</p>
        </div>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAdd}><Plus className="mr-2 h-4 w-4" />Nuevo</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[550px]" onInteractOutside={(e) => { e.preventDefault(); handleCancel(); }}>
            <DialogHeader>
              <DialogTitle>{editingInmueble ? "Editar Inmueble" : "Nuevo Inmueble"}</DialogTitle>
              <DialogDescription>{editingInmueble ? "Modifica los datos del inmueble" : "Ingresa la información del nuevo inmueble"}</DialogDescription>
            </DialogHeader>
            <InmuebleForm inmuebleToEdit={editingInmueble} onSubmit={handleSubmit} onCancel={handleCancel} />
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
              <Input id="search" placeholder="Nombre o código de inmueble..." value={filters.search} onChange={(e) => handleFilterChange("search", e.target.value)} />
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
          <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4" />Lista de Inmuebles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Inmueble</TableHead>
                  <TableHead>Institución</TableHead>
                  <TableHead>Localidad</TableHead>
                  <TableHead>Ciudad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length > 0 ? paginatedData.map(a => (
                  <TableRow key={a.codigoinmueble}>
                    <TableCell className="font-medium">{a.codigoinmueble}</TableCell>
                    <TableCell className="whitespace-normal break-words max-w-[200px]">{a.inmueble}</TableCell>
                    <TableCell className="font-mono text-xs">{a.codigoinstitucion || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{a.codigolocalidad || "—"}</TableCell>
                    <TableCell>{a.codigociudad || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={a.estado === 1 ? "default" : "secondary"}>{ESTADO_MAP[a.estado] || "—"}</Badge>
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
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <Building2 className="mx-auto h-12 w-12 opacity-20 mb-2" />
                      <p className="text-lg font-medium">{filters.search ? "No se encontraron inmuebles" : "No hay inmuebles registrados"}</p>
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
            <DialogTitle>¿Está seguro de eliminar este inmueble?</DialogTitle>
            <DialogDescription>Esta acción no se puede deshacer. El inmueble "{inmuebleToDelete?.inmueble}" será eliminado permanentemente.</DialogDescription>
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

export default InmuebleList;
