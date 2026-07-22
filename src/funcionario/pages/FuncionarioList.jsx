import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
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
import { Plus, Edit, Trash2, Users, Filter, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  fetchFuncionario,
  addFuncionario,
  updateFuncionario,
  deleteFuncionario,
} from "@/store/funcionario/funcionarioThunks";
import {
  selectSortedFuncionario,
  selectFuncionarioLoading,
  selectFuncionarioError,
} from "@/store/funcionario/funcionarioSlice";
import FuncionarioForm from "./FuncionarioForm";

const INITIAL_FILTERS = {
  search: "",
  sexo: "",
  ec: "",
};

const MESSAGES = {
  success: {
    created: "El funcionario ha sido guardado exitosamente.",
    updated: "El funcionario se ha actualizado correctamente.",
    deleted: "El funcionario se ha eliminado correctamente.",
  },
  error: {
    loading: "Error al cargar funcionarios",
    save: "Fallo al guardar el funcionario",
    delete: "Error al eliminar el funcionario",
    unknown: "Error desconocido",
  },
  empty: {
    noData: "No hay funcionarios registrados",
    filtered: "No se encontraron funcionarios que coincidan con los filtros",
    createFirst: 'Crea tu primer funcionario usando el botón "Nuevo Funcionario"',
    adjustFilters: "Intenta ajustar los filtros de búsqueda",
  },
  placeholders: {
    search: "Buscar por CI, código, nombres o apellidos...",
    sexo: "Todos los sexos",
    ec: "Todos los estados civiles",
  },
};

const EC_OPTIONS = [
  { value: "S", label: "Soltero" },
  { value: "C", label: "Casado" },
  { value: "D", label: "Divorciado" },
  { value: "V", label: "Viudo" },
];

const SEXO_OPTIONS = [
  { value: "M", label: "Masculino" },
  { value: "F", label: "Femenino" },
];

const EC_MAP = EC_OPTIONS.reduce((acc, o) => { acc[o.value] = o.label; return acc; }, {});
const SEXO_MAP = SEXO_OPTIONS.reduce((acc, o) => { acc[o.value] = o.label; return acc; }, {});
const EMPTY_ARRAY = [];

const FuncionarioList = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();

  const funcionarios = useSelector(selectSortedFuncionario);
  const isLoading = useSelector(selectFuncionarioLoading);
  const error = useSelector(selectFuncionarioError);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingFuncionario, setEditingFuncionario] = useState(null);
  const [funcionarioToDelete, setFuncionarioToDelete] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [filters, setFilters] = useState({ ...INITIAL_FILTERS });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  useEffect(() => {
    dispatch(fetchFuncionario());
  }, [dispatch]);

  const handleAdd = useCallback(() => {
    setEditingFuncionario(null);
    setIsFormOpen(true);
  }, []);

  const handleEdit = useCallback((funcionario) => {
    setEditingFuncionario(funcionario);
    setIsFormOpen(true);
  }, []);

  const handleDelete = useCallback((funcionario) => {
    setFuncionarioToDelete(funcionario);
    setIsDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (funcionarioToDelete) {
      dispatch(deleteFuncionario(funcionarioToDelete.cirun));
      setIsDeleteDialogOpen(false);
      setFuncionarioToDelete(null);
      toast({
        title: "¡Éxito!",
        description: MESSAGES.success.deleted,
        variant: "default",
      });
    }
  }, [funcionarioToDelete, dispatch, toast]);

  const handleCancel = useCallback(() => {
    setIsFormOpen(false);
    setEditingFuncionario(null);
  }, []);

  const handleFilterChange = useCallback((filterType, value) => {
    setFilters((prev) => ({ ...prev, [filterType]: value }));
  }, []);

  const filteredFuncionarios = useMemo(
    () =>
      funcionarios
        .filter((f) => {
          const searchStr =
            `${f.cirun || ""} ${f.codigo || ""} ${f.nombres || ""} ${f.paterno || ""} ${f.materno || ""}`.toLowerCase();
          const searchMatch =
            !filters.search ||
            searchStr.includes(filters.search.toLowerCase());

          const sexoMatch =
            !filters.sexo ||
            filters.sexo === "all" ||
            (f.sexo || "") === filters.sexo;

          const ecMatch =
            !filters.ec ||
            filters.ec === "all" ||
            (f.ec || "") === filters.ec;

          return searchMatch && sexoMatch && ecMatch;
        }),
    [funcionarios, filters]
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredFuncionarios.length / pageSize)),
    [filteredFuncionarios.length, pageSize]
  );

  const safeCurrentPage = useMemo(
    () => Math.min(currentPage, totalPages),
    [currentPage, totalPages]
  );

  const paginatedFuncionarios = useMemo(
    () => {
      const start = (safeCurrentPage - 1) * pageSize;
      return filteredFuncionarios.slice(start, start + pageSize);
    },
    [filteredFuncionarios, safeCurrentPage, pageSize]
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const handlePageSizeChange = useCallback((newSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ ...INITIAL_FILTERS });
    setCurrentPage(1);
  }, []);

  const hasActiveFilters = useMemo(
    () =>
      filters.search !== "" ||
      filters.sexo !== "" ||
      filters.ec !== "",
    [filters]
  );

  const handleSubmit = useCallback(
    async (funcionarioData) => {
      const action = editingFuncionario
        ? updateFuncionario({ cirun: editingFuncionario.cirun, updatedFuncionario: funcionarioData })
        : addFuncionario(funcionarioData);
      try {
        await dispatch(action).unwrap();
        toast({
          title: "¡Éxito!",
          description: editingFuncionario
            ? MESSAGES.success.updated
            : MESSAGES.success.created,
          variant: "default",
        });
        handleCancel();
        return true;
      } catch (error) {
        console.error("Error saving funcionario:", error);
        toast({
          title: "Error",
          description: `${MESSAGES.error.save}: ${error.message || MESSAGES.error.unknown}`,
          variant: "destructive",
        });
        return false;
      }
    },
    [dispatch, editingFuncionario, toast, handleCancel]
  );

  if (isLoading && funcionarios.length === 0) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="bg-red-600 text-white text-center p-6 rounded-lg">
        <p className="text-lg font-medium">{MESSAGES.error.loading}</p>
        <p className="text-sm mt-2">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Funcionarios</h1>
          <p className="text-muted-foreground">
            Administra los funcionarios del sistema
          </p>
        </div>

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
              <DialogTitle>
                {editingFuncionario ? "Editar Funcionario" : "Nuevo Funcionario"}
              </DialogTitle>
              <DialogDescription>
                {editingFuncionario
                  ? "Modifica los datos del funcionario"
                  : "Ingresa la información del nuevo funcionario"}
              </DialogDescription>
            </DialogHeader>
            <FuncionarioForm
              funcionarioToEdit={editingFuncionario}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="ml-auto h-7 px-2 text-muted-foreground hover:text-foreground"
                title="Limpiar filtros"
              >
                <X className="h-4 w-4 mr-1" />
                Limpiar
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Buscar</Label>
              <Input
                id="search"
                placeholder={MESSAGES.placeholders.search}
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sexo">Sexo</Label>
              <Select
                value={filters.sexo}
                onValueChange={(value) => handleFilterChange("sexo", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={MESSAGES.placeholders.sexo} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{MESSAGES.placeholders.sexo}</SelectItem>
                  {SEXO_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ec">Estado Civil</Label>
              <Select
                value={filters.ec}
                onValueChange={(value) => handleFilterChange("ec", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={MESSAGES.placeholders.ec} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{MESSAGES.placeholders.ec}</SelectItem>
                  {EC_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Lista de Funcionarios
          </CardTitle>
          <CardDescription>
            Todos los funcionarios registrados en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CI / RUT</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Apellido Paterno</TableHead>
                  <TableHead>Apellido Materno</TableHead>
                  <TableHead>Nombres</TableHead>
                  <TableHead>CI Exp.</TableHead>
                  <TableHead>Sexo</TableHead>
                  <TableHead>E. Civil</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Celular</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedFuncionarios.length > 0 ? (
                  paginatedFuncionarios.map((f) => (
                    <TableRow key={f.cirun}>
                      <TableCell className="font-medium font-mono text-xs">
                        {f.cirun}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{f.codigo}</TableCell>
                      <TableCell>{f.paterno}</TableCell>
                      <TableCell>{f.materno || "—"}</TableCell>
                      <TableCell className="font-medium">{f.nombres}</TableCell>
                      <TableCell>{f.ciexp || "—"}</TableCell>
                      <TableCell>{SEXO_MAP[f.sexo] || f.sexo || "—"}</TableCell>
                      <TableCell>{EC_MAP[f.ec] || f.ec || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{f.tel || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{f.cel || "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex space-x-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(f)}
                            title="Editar funcionario"
                            className="text-yellow-500 hover:text-yellow-700"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(f)}
                            title="Eliminar funcionario"
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={11}
                      className="text-center py-12 text-muted-foreground"
                    >
                      <Users className="mx-auto h-12 w-12 opacity-20 mb-2" />
                      <p className="text-lg font-medium">
                        {filters.search || filters.sexo || filters.ec
                          ? MESSAGES.empty.filtered
                          : MESSAGES.empty.noData}
                      </p>
                      <p className="text-sm mt-1">
                        {filters.search || filters.sexo || filters.ec
                          ? MESSAGES.empty.adjustFilters
                          : MESSAGES.empty.createFirst}
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {filteredFuncionarios.length > 0 && (
            <DataPagination
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              totalCount={filteredFuncionarios.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={handlePageSizeChange}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Está seguro de eliminar este funcionario?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. El funcionario "
              {funcionarioToDelete?.nombres} {funcionarioToDelete?.paterno}"
              será eliminado permanentemente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FuncionarioList;
