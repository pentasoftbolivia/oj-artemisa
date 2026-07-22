import { useState, useEffect, useCallback, useMemo } from "react";
import { useSelector, useDispatch, useStore } from "react-redux";
import { createLookupMap } from "@/lib/utils";

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
import {
  Plus,
  Eye,
  Edit,
  Trash2,
  MoveHorizontal,
  Filter,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCatalogos } from "@/hooks/useCatalogos";
import MovimientosForm from "./MovimientosForm";

import {
  fetchMovimientos,
  addMovimiento,
  updateMovimiento,
  deleteMovimiento,
  fetchDetallesByMovimientoId,
} from "@/store/movimientos/movimientosThunks";
import {
  selectMovimientos,
  selectMovimientosLoading,
  selectMovimientosError,
  selectDetallesByMovimientoId,
} from "@/store/movimientos/movimientosSlice";
import { selectUser } from "@/store/auth/authSlice";

const INITIAL_FILTERS = {
  search: "",
  tipoMovimientoId: "",
  estadoMovimiento: "",
};

const ESTADO_MOVIMIENTO_OPTIONS = [
  "BORRADOR",
  "ASIGNADO",
  "APROBADO",
  "RECHAZADO",
];

const MESSAGES = {
  empty: {
    noData: "No hay movimientos registrados",
    filtered: "No se encontraron movimientos que coincidan con los filtros",
  },
};

const EMPTY_ARRAY = [];

const MovimientosList = () => {
  const dispatch = useDispatch();
  const store = useStore();
  const { toast } = useToast();

  const movimientos = useSelector(selectMovimientos);
  const isLoading = useSelector(selectMovimientosLoading);
  const error = useSelector(selectMovimientosError);
  const user = useSelector(selectUser);

  const [filters, setFilters] = useState({ ...INITIAL_FILTERS });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMovimiento, setEditingMovimiento] = useState(null);
  const [initialDetalles, setInitialDetalles] = useState([]);

  const [detalleModalOpen, setDetalleModalOpen] = useState(false);
  const [detalleModalTitle, setDetalleModalTitle] = useState("");
  const [detalleModalData, setDetalleModalData] = useState(null);
  const [detalleModalLoading, setDetalleModalLoading] = useState(false);

  const [movimientoToDelete, setMovimientoToDelete] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const { data: catalogos, loading: loadingFK } = useCatalogos([
    { table: "tipos_movimiento", columns: "id, codigo, nombre" },
    {
      table: "funcionarios",
      columns:
        "id, nombres, apellido_paterno, apellido_materno, numero_documento",
    },
    { table: "ubicaciones", columns: "id, nombre" },
    {
      table: "activos_fijos",
      columns:
        "id, codigo_patrimonial, denominacion, funcionario_custodio_id, estado",
    },
    { table: "estados_activo", columns: "id, codigo, nombre, color_hex" },
  ]);

  const tiposMovimiento = catalogos.tipos_movimiento || EMPTY_ARRAY;
  const funcionarios = catalogos.funcionarios || EMPTY_ARRAY;
  const ubicaciones = catalogos.ubicaciones || EMPTY_ARRAY;
  const activos = catalogos.activos_fijos || EMPTY_ARRAY;
  const estadosActivo = catalogos.estados_activo || EMPTY_ARRAY;

  const [catalogsReady, setCatalogsReady] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    if (!loadingFK && !catalogsReady) {
      setCatalogsReady(true);
      dispatch(fetchMovimientos());
    }
  }, [loadingFK, catalogsReady, dispatch]);

  const handleFilterChange = useCallback((filterType, value) => {
    setFilters((prev) => ({ ...prev, [filterType]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ ...INITIAL_FILTERS });
    setCurrentPage(1);
  }, []);

  const hasActiveFilters = useMemo(
    () =>
      filters.search !== "" ||
      filters.tipoMovimientoId !== "" ||
      filters.estadoMovimiento !== "",
    [filters],
  );

  const filteredMovimientos = useMemo(
    () =>
      movimientos.filter((m) => {
        const searchStr =
          `${m.id || ""} ${m.numero_acta || ""} ${m.numero_resolucion || ""} ${m.motivo || ""}`.toLowerCase();
        const searchMatch =
          !filters.search || searchStr.includes(filters.search.toLowerCase());

        const tipoMatch =
          !filters.tipoMovimientoId ||
          filters.tipoMovimientoId === "all" ||
          m.tipo_movimiento_id?.toString() === filters.tipoMovimientoId;

        const estadoMatch =
          !filters.estadoMovimiento ||
          filters.estadoMovimiento === "all" ||
          (m.estado_movimiento || "") === filters.estadoMovimiento;

        return searchMatch && tipoMatch && estadoMatch;
      }),
    [movimientos, filters],
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredMovimientos.length / pageSize)),
    [filteredMovimientos.length, pageSize],
  );

  const safeCurrentPage = useMemo(
    () => Math.min(currentPage, totalPages),
    [currentPage, totalPages],
  );

  const paginatedMovimientos = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredMovimientos.slice(start, start + pageSize);
  }, [filteredMovimientos, safeCurrentPage, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [currentPage, totalPages]);

  const getPageNumbers = useCallback(() => {
    const pages = [];
    const total = totalPages;
    const current = safeCurrentPage;
    if (total <= 5) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push("...");
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (current < total - 2) pages.push("...");
      pages.push(total);
    }
    return pages;
  }, [totalPages, safeCurrentPage]);

  const handlePageSizeChange = useCallback((newSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
  }, []);

  const tiposMovimientoMap = useMemo(
    () => createLookupMap(tiposMovimiento, "id"),
    [tiposMovimiento],
  );
  const funcionariosMap = useMemo(
    () =>
      createLookupMap(funcionarios, "id", (f) =>
        `${f.nombres} ${f.apellido_paterno} ${f.apellido_materno || ""}`.trim(),
      ),
    [funcionarios],
  );
  const ubicacionesMap = useMemo(
    () => createLookupMap(ubicaciones, "id", (u) => u.nombre),
    [ubicaciones],
  );
  const activosMap = useMemo(
    () =>
      createLookupMap(
        activos,
        "id",
        (a) => `${a.codigo_patrimonial} - ${a.denominacion}`,
      ),
    [activos],
  );
  const estadosActivoMap = useMemo(
    () => createLookupMap(estadosActivo, "id"),
    [estadosActivo],
  );

  const estadoBadgeVariant = useCallback((estado) => {
    switch (estado) {
      case "APROBADO":
        return "default";
      case "ASIGNADO":
        return "default";
      case "BORRADOR":
        return "secondary";
      case "RECHAZADO":
        return "destructive";
      default:
        return "outline";
    }
  }, []);

  const handleOpenForm = useCallback(
    async (movimiento = null) => {
      if (movimiento) {
        setEditingMovimiento(movimiento);
        setInitialDetalles([]);

        let detalles = selectDetallesByMovimientoId(
          store.getState(),
          movimiento.id,
        );
        if (!detalles) {
          const result = await dispatch(
            fetchDetallesByMovimientoId(movimiento.id),
          );
          detalles = result.payload?.detalles;
        }

        if (detalles) {
          setInitialDetalles(
            detalles.map((d) => ({
              activo_id: d.activo_id,
              estado_activo_anterior:
                d.estado_activo_anterior?.toString() || "",
              estado_activo_nuevo: d.estado_activo_nuevo?.toString() || "",
              condicion_anterior: d.condicion_anterior || "",
              condicion_nueva: d.condicion_nueva || "",
              observaciones: d.observaciones || "",
              numero_linea: d.numero_linea,
              _tempId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            })),
          );
        }
      } else {
        setEditingMovimiento(null);
        setInitialDetalles([]);
      }
      setIsFormOpen(true);
    },
    [dispatch, store],
  );

  const handleCloseForm = useCallback(() => {
    setIsFormOpen(false);
    setEditingMovimiento(null);
    setInitialDetalles([]);
  }, []);

  const handleEdit = useCallback(
    (movimiento) => {
      handleOpenForm(movimiento);
    },
    [handleOpenForm],
  );

  const handleDelete = useCallback((movimiento) => {
    setMovimientoToDelete(movimiento);
    setIsDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (movimientoToDelete) {
      dispatch(deleteMovimiento(movimientoToDelete.id));
      setIsDeleteDialogOpen(false);
      setMovimientoToDelete(null);
      toast({
        title: "¡Éxito!",
        description: `Movimiento #${movimientoToDelete.id} eliminado correctamente.`,
      });
    }
  }, [movimientoToDelete, dispatch, toast]);

  const handleFormSubmit = useCallback(
    async ({ cabecera, detalles }) => {
      try {
        const action = editingMovimiento
          ? updateMovimiento({ id: editingMovimiento.id, cabecera, detalles })
          : addMovimiento({ cabecera, detalles });
        const result = await dispatch(action).unwrap();
        toast({
          title: "¡Éxito!",
          description: editingMovimiento
            ? `Movimiento #${result.cabecera.id} actualizado con ${result.detalles.length} detalle(s)`
            : `Movimiento #${result.cabecera.id} creado con ${result.detalles.length} detalle(s)`,
        });
        dispatch(fetchMovimientos());
        return true;
      } catch (err) {
        toast({
          title: "Error",
          description: `Error al ${editingMovimiento ? "actualizar" : "crear"} movimiento: ${err.message || err}`,
          variant: "destructive",
        });
        return false;
      }
    },
    [editingMovimiento, dispatch, toast],
  );

  const openDetalleModal = useCallback(
    async (movimiento) => {
      setDetalleModalTitle(
        `Movimiento #${movimiento.id} - ${tiposMovimientoMap[movimiento.tipo_movimiento_id]?.nombre || ""}`,
      );
      setDetalleModalData(movimiento);
      setDetalleModalOpen(true);
      setDetalleModalLoading(true);

      const cached = selectDetallesByMovimientoId(
        store.getState(),
        movimiento.id,
      );
      if (!cached) {
        await dispatch(fetchDetallesByMovimientoId(movimiento.id));
      }
      setDetalleModalLoading(false);
    },
    [dispatch, store, tiposMovimientoMap],
  );

  if (!catalogsReady || (isLoading && movimientos.length === 0))
    return <LoadingSpinner />;

  if (error) {
    return (
      <div className="bg-red-600 text-white text-center p-6 rounded-lg">
        <p className="text-lg font-medium">Error al cargar movimientos</p>
        <p className="text-sm mt-2">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Movimientos</h1>
          <p className="text-muted-foreground">
            Administra los movimientos de activos fijos
          </p>
        </div>
        <Button onClick={() => handleOpenForm()}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo
        </Button>
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
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Buscar por ID, acta, resolución..."
                  className="pl-8"
                  value={filters.search}
                  onChange={(e) => handleFilterChange("search", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipoMovimientoId">Tipo de Movimiento</Label>
              <Select
                value={filters.tipoMovimientoId}
                onValueChange={(value) =>
                  handleFilterChange("tipoMovimientoId", value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos los tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {tiposMovimiento.map((t) => (
                    <SelectItem key={t.id} value={t.id.toString()}>
                      {t.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="estadoMovimiento">Estado</Label>
              <Select
                value={filters.estadoMovimiento}
                onValueChange={(value) =>
                  handleFilterChange("estadoMovimiento", value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {ESTADO_MOVIMIENTO_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
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
            <MoveHorizontal className="h-5 w-5" />
            Lista de Movimientos
          </CardTitle>
          <CardDescription>
            Todos los movimientos registrados en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">ID</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Funcionario</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>N° Acta</TableHead>
                  <TableHead>N° Resolución</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedMovimientos.length > 0 ? (
                  paginatedMovimientos.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-muted-foreground text-xs">
                        {m.id}
                      </TableCell>
                      <TableCell className="font-medium whitespace-normal break-words max-w-[150px]">
                        {tiposMovimientoMap[m.tipo_movimiento_id]?.nombre ||
                          `ID: ${m.tipo_movimiento_id}`}
                      </TableCell>
                      <TableCell>{m.fecha_movimiento || "—"}</TableCell>
                      <TableCell className="whitespace-normal break-words max-w-[150px]">
                        {m.funcionario_destino_id
                          ? funcionariosMap[m.funcionario_destino_id] ||
                            `ID: ${m.funcionario_destino_id}`
                          : "—"}
                      </TableCell>
                      <TableCell className="whitespace-normal break-words max-w-[180px]">
                        {m.ubicacion_destino_id
                          ? ubicacionesMap[m.ubicacion_destino_id] ||
                            `ID: ${m.ubicacion_destino_id}`
                          : "—"}
                      </TableCell>
                      <TableCell>{m.numero_acta || "—"}</TableCell>
                      <TableCell>{m.numero_resolucion || "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={estadoBadgeVariant(m.estado_movimiento)}
                        >
                          {m.estado_movimiento}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex space-x-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDetalleModal(m)}
                            title="Ver detalles"
                            className="text-blue-500 hover:text-blue-700"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Detalles ({m.movimientos_detalle?.[0]?.count ?? 0})
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(m)}
                            title="Editar movimiento"
                            className="text-yellow-500 hover:text-yellow-700"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(m)}
                            title="Eliminar movimiento"
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
                      colSpan={10}
                      className="text-center py-12 text-muted-foreground"
                    >
                      <MoveHorizontal className="mx-auto h-12 w-12 opacity-20 mb-2" />
                      <p className="text-lg font-medium">
                        {hasActiveFilters
                          ? MESSAGES.empty.filtered
                          : MESSAGES.empty.noData}
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {filteredMovimientos.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Mostrar</span>
                <Select
                  value={pageSize.toString()}
                  onValueChange={(v) => handlePageSizeChange(Number(v))}
                >
                  <SelectTrigger className="h-8 w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                  </SelectContent>
                </Select>
                <span>por página</span>
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <span>
                  {(safeCurrentPage - 1) * pageSize + 1} —{" "}
                  {Math.min(
                    safeCurrentPage * pageSize,
                    filteredMovimientos.length,
                  )}{" "}
                  de {filteredMovimientos.length} registros
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={safeCurrentPage === 1}
                  onClick={() => setCurrentPage(1)}
                  title="Primera página"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={safeCurrentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  title="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {getPageNumbers().map((page, idx) =>
                  page === "..." ? (
                    <span
                      key={`ellipsis-${idx}`}
                      className="px-1 text-muted-foreground"
                    >
                      ...
                    </span>
                  ) : (
                    <Button
                      key={page}
                      variant={safeCurrentPage === page ? "default" : "outline"}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  ),
                )}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={safeCurrentPage === totalPages}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  title="Página siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={safeCurrentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  title="Última página"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent
          className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto"
          onInteractOutside={(e) => {
            e.preventDefault();
            handleCloseForm();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {editingMovimiento ? "Editar Movimiento" : "Nuevo Movimiento"}
            </DialogTitle>
            <DialogDescription>
              {editingMovimiento
                ? "Modifica los datos del movimiento"
                : "Registra un nuevo movimiento de activos fijos"}
            </DialogDescription>
          </DialogHeader>
          <MovimientosForm
            movimientoToEdit={editingMovimiento}
            initialDetalles={initialDetalles}
            onSubmit={handleFormSubmit}
            onCancel={handleCloseForm}
            tiposMovimiento={tiposMovimiento}
            funcionarios={funcionarios}
            ubicaciones={ubicaciones}
            activos={activos}
            estadosActivo={estadosActivo}
            loadingFK={loadingFK}
            toast={toast}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={detalleModalOpen} onOpenChange={setDetalleModalOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detalleModalTitle}</DialogTitle>
            <DialogDescription>
              Detalle de los activos incluidos en este movimiento
            </DialogDescription>
          </DialogHeader>

          {detalleModalData && (
            <div className="mb-4 p-3 bg-muted/30 rounded-lg text-sm grid grid-cols-2 md:grid-cols-4 gap-2">
              <div>
                <span className="text-muted-foreground">ID:</span>{" "}
                <span className="font-medium">{detalleModalData.id}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Tipo:</span>{" "}
                <span className="font-medium">
                  {tiposMovimientoMap[detalleModalData.tipo_movimiento_id]
                    ?.nombre || "—"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Fecha:</span>{" "}
                <span className="font-medium">
                  {detalleModalData.fecha_movimiento}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Estado:</span>{" "}
                <Badge
                  variant={estadoBadgeVariant(
                    detalleModalData.estado_movimiento,
                  )}
                >
                  {detalleModalData.estado_movimiento}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Func. Destino:</span>{" "}
                <span className="font-medium">
                  {detalleModalData.funcionario_destino_id
                    ? funcionariosMap[detalleModalData.funcionario_destino_id]
                    : "—"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Ubic. Destino:</span>{" "}
                <span className="font-medium">
                  {detalleModalData.ubicacion_destino_id
                    ? ubicacionesMap[detalleModalData.ubicacion_destino_id]
                    : "—"}
                </span>
              </div>
            </div>
          )}

          <DetalleTable
            movimientoId={detalleModalData?.id}
            activosMap={activosMap}
            estadosActivoMap={estadosActivoMap}
            loading={detalleModalLoading}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Está seguro de eliminar este movimiento?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. El movimiento #
              {movimientoToDelete?.id}
              {" - "}
              {tiposMovimientoMap[movimientoToDelete?.tipo_movimiento_id]
                ?.nombre || ""}
              será eliminado permanentemente junto con todos sus detalles.
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

const DetalleTable = ({
  movimientoId,
  activosMap,
  estadosActivoMap,
  loading,
}) => {
  const cachedDetalles = useSelector((state) =>
    selectDetallesByMovimientoId(state, movimientoId),
  );

  if (loading && !cachedDetalles) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  const detalles = cachedDetalles || [];

  if (detalles.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No se encontraron detalles para este movimiento.
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>ID Activo</TableHead>
            <TableHead>Activo</TableHead>
            <TableHead>Estado Anterior</TableHead>
            <TableHead>Estado Nuevo</TableHead>
            <TableHead>Condición</TableHead>
            <TableHead>Observaciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {detalles.map((d) => (
            <TableRow key={d.id}>
              <TableCell className="text-muted-foreground">
                {d.numero_linea}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {d.activo_id}
              </TableCell>
              <TableCell className="font-medium whitespace-normal break-words max-w-[200px]">
                {activosMap[d.activo_id] || `ID: ${d.activo_id}`}
              </TableCell>
              <TableCell>
                {d.estado_activo_anterior
                  ? estadosActivoMap[d.estado_activo_anterior]?.nombre ||
                    `ID: ${d.estado_activo_anterior}`
                  : "—"}
              </TableCell>
              <TableCell>
                {d.estado_activo_nuevo
                  ? estadosActivoMap[d.estado_activo_nuevo]?.nombre ||
                    `ID: ${d.estado_activo_nuevo}`
                  : "—"}
              </TableCell>
              <TableCell>
                {d.condicion_nueva || d.condicion_anterior || "—"}
              </TableCell>
              <TableCell className="whitespace-normal break-words max-w-[200px]">
                {d.observaciones || "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="p-3 text-sm text-muted-foreground border-t">
        Total: <strong>{detalles.length}</strong> activo(s) en este movimiento
      </div>
    </div>
  );
};

export default MovimientosList;
