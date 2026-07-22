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
  fetchTipoRubros,
  addTipoRubro,
  updateTipoRubro,
  deleteTipoRubro,
} from "@/store/tiporubro/tiporubroThunks";
import {
  selectTipoRubros,
  selectTipoRubrosLoading,
  selectTipoRubrosError,
} from "@/store/tiporubro/tiporubroSlice";
import TipoRubroForm from "./TipoRubroForm";

const INITIAL_FILTERS = { search: "" };
const ESTADO_MAP = { 1: "Activo", 0: "Inactivo" };

const TipoRubroList = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();
  const tipoRubros = useSelector(selectTipoRubros);
  const isLoading = useSelector(selectTipoRubrosLoading);
  const error = useSelector(selectTipoRubrosError);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTipoRubro, setEditingTipoRubro] = useState(null);
  const [tipoRubroToDelete, setTipoRubroToDelete] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [filters, setFilters] = useState({ ...INITIAL_FILTERS });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  const [rubrosMap, setRubrosMap] = useState({});

  useEffect(() => { dispatch(fetchTipoRubros()); }, [dispatch]);

  useEffect(() => {
    import("@/lib/supabase").then(({ supabase }) => {
      supabase
        .from("act_rubro")
        .select("codigorubroact, descripcionrubroact")
        .then(({ data }) => {
          if (data) {
            const map = {};
            data.forEach(r => { map[r.codigorubroact] = r.descripcionrubroact; });
            setRubrosMap(map);
          }
        });
    });
  }, []);

  const handleAdd = useCallback(() => { setEditingTipoRubro(null); setIsFormOpen(true); }, []);
  const handleEdit = useCallback((a) => { setEditingTipoRubro(a); setIsFormOpen(true); }, []);
  const handleDelete = useCallback((a) => { setTipoRubroToDelete(a); setIsDeleteDialogOpen(true); }, []);

  const confirmDelete = useCallback(() => {
    if (tipoRubroToDelete) {
      dispatch(deleteTipoRubro(tipoRubroToDelete.tiporubroact));
      setIsDeleteDialogOpen(false);
      setTipoRubroToDelete(null);
      toast({ title: "¡Éxito!", description: "El tipo de rubro se ha eliminado correctamente." });
    }
  }, [tipoRubroToDelete, dispatch, toast]);

  const handleCancel = useCallback(() => { setIsFormOpen(false); setEditingTipoRubro(null); }, []);
  const handleFilterChange = useCallback((type, value) => { setFilters(p => ({ ...p, [type]: value })); setCurrentPage(1); }, []);
  const clearFilters = useCallback(() => { setFilters({ ...INITIAL_FILTERS }); setCurrentPage(1); }, []);

  const filtered = useMemo(() =>
    tipoRubros.filter(a => {
      const s = `${a.descripciontiporubroact || ""} ${a.tiporubroact || ""}`.toLowerCase();
      return !filters.search || s.includes(filters.search.toLowerCase());
    }).sort((a, b) => (a.descripciontiporubroact || "").localeCompare(b.descripciontiporubroact || "")), [tipoRubros, filters]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / pageSize)), [filtered.length, pageSize]);
  const safeCurrentPage = useMemo(() => Math.min(currentPage, totalPages), [currentPage, totalPages]);
  const paginatedData = useMemo(() => { const start = (safeCurrentPage - 1) * pageSize; return filtered.slice(start, start + pageSize); }, [filtered, safeCurrentPage, pageSize]);

  const handleSubmit = useCallback(async (data) => {
    const action = editingTipoRubro
      ? updateTipoRubro({ tiporubroact: editingTipoRubro.tiporubroact, updatedTipoRubro: data })
      : addTipoRubro(data);
    try {
      await dispatch(action).unwrap();
      toast({ title: "¡Éxito!", description: `El tipo de rubro se ha ${editingTipoRubro ? "actualizado" : "guardado"} correctamente.` });
      handleCancel();
      return true;
    } catch (err) {
      toast({ title: "Error", description: `Fallo al guardar: ${err.message || "Error desconocido"}`, variant: "destructive" });
      return false;
    }
  }, [dispatch, editingTipoRubro, toast, handleCancel]);

  if (isLoading && tipoRubros.length === 0) return <LoadingSpinner />;
  if (error) return <div className="bg-red-600 text-white text-center p-4 rounded-lg">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tipos de Rubro</h1>
          <p className="text-muted-foreground">Administra los tipos de rubro del sistema</p>
        </div>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAdd}><Plus className="mr-2 h-4 w-4" />Nuevo</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]" onInteractOutside={(e) => { e.preventDefault(); handleCancel(); }}>
            <DialogHeader>
              <DialogTitle>{editingTipoRubro ? "Editar Tipo de Rubro" : "Nuevo Tipo de Rubro"}</DialogTitle>
              <DialogDescription>{editingTipoRubro ? "Modifica los datos del tipo de rubro" : "Ingresa la información del nuevo tipo de rubro"}</DialogDescription>
            </DialogHeader>
            <TipoRubroForm tiporubroToEdit={editingTipoRubro} onSubmit={handleSubmit} onCancel={handleCancel} />
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
              <Input id="search" placeholder="Nombre o código..." value={filters.search} onChange={(e) => handleFilterChange("search", e.target.value)} />
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
          <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4" />Lista de Tipos de Rubro</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Rubro</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length > 0 ? paginatedData.map(a => (
                  <TableRow key={a.tiporubroact}>
                    <TableCell className="font-medium">{a.tiporubroact}</TableCell>
                    <TableCell className="whitespace-normal break-words max-w-[200px]">{a.descripciontiporubroact}</TableCell>
                    <TableCell>{rubrosMap[a.codigorubroact] || a.codigorubroact || "—"}</TableCell>
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
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      <Building2 className="mx-auto h-12 w-12 opacity-20 mb-2" />
                      <p className="text-lg font-medium">{filters.search ? "No se encontraron tipos de rubro" : "No hay tipos de rubro registrados"}</p>
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
            <DialogTitle>¿Está seguro de eliminar este tipo de rubro?</DialogTitle>
            <DialogDescription>Esta acción no se puede deshacer. El tipo de rubro "{tipoRubroToDelete?.descripciontiporubroact}" será eliminado permanentemente.</DialogDescription>
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

export default TipoRubroList;
