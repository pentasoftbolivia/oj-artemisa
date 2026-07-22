import { useState, useEffect, useCallback, useRef } from "react";
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import ComboboxField from "@/components/ui/combobox-field";
import { ClipboardList, Filter, X, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";

import { fetchAsignaciones } from "@/store/asignaciones/asignacionesThunks";
import {
  resetAsignaciones,
  selectAsignacionesData,
  selectAsignacionesTotalCount,
  selectAsignacionesLoading,
  selectAsignacionesError,
} from "@/store/asignaciones/asignacionesSlice";

const ESTADOS = ["Activo", "Baja"];

const INITIAL_FILTERS = {
  searchNombre1: "",
  searchNombre2: "",
  searchPaterno: "",
  searchMaterno: "",
  searchActivo: "",
  searchGrupo: "",
  estado: "",
};

const EMPTY_ARRAY = [];

const AsignacionesList = () => {
  const dispatch = useDispatch();

  const asignaciones = useSelector(selectAsignacionesData);
  const totalCount = useSelector(selectAsignacionesTotalCount);
  const isLoading = useSelector(selectAsignacionesLoading);
  const error = useSelector(selectAsignacionesError);

  const [rubros, setRubros] = useState(EMPTY_ARRAY);
  useEffect(() => {
    supabase
      .from("act_rubro")
      .select("descripcionrubroact")
      .order("descripcionrubroact", { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setRubros(data);
      });
  }, []);

  const [filters, setFilters] = useState({ ...INITIAL_FILTERS });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const hasActiveFilters =
    filters.searchNombre1 || filters.searchNombre2 || filters.searchPaterno || filters.searchMaterno ||
    filters.searchActivo || filters.searchGrupo || filters.estado;

  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      if (!hasActiveFilters) {
        dispatch(resetAsignaciones());
        return;
      }
      dispatch(
        fetchAsignaciones({ page: currentPage, pageSize, filters })
      );
    }, 800);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [dispatch, hasActiveFilters, currentPage, pageSize, filters]);

  const handleFilterChange = useCallback((filterType, value) => {
    setFilters((prev) => ({
      ...prev,
      [filterType]: value === "__todos__" ? "" : value,
    }));
    setCurrentPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ ...INITIAL_FILTERS });
    setCurrentPage(1);
  }, []);

  const getNombreCompleto = useCallback((a) => {
    const partes = [a.nombre1, a.nombre2, a.paterno, a.materno].filter(Boolean);
    return partes.join(" ") || "—";
  }, []);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const showPagination = totalCount > 0;

  if (isLoading && asignaciones.length === 0) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="bg-red-600 text-white text-center p-6 rounded-lg">
        <p className="text-lg font-medium">Error al cargar asignaciones</p>
        <p className="text-sm mt-2">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Asignaciones</h1>
        <p className="text-muted-foreground">
          Visualiza las asignaciones de activos a funcionarios (Usa los filtros
          para buscar información)
        </p>
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
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="searchNombre1">Primer nombre</Label>
                <Input
                  id="searchNombre1"
                  placeholder="Primer nombre..."
                  value={filters.searchNombre1}
                  onChange={(e) =>
                    handleFilterChange("searchNombre1", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="searchNombre2">Segundo nombre</Label>
                <Input
                  id="searchNombre2"
                  placeholder="Segundo nombre..."
                  value={filters.searchNombre2}
                  onChange={(e) =>
                    handleFilterChange("searchNombre2", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="searchPaterno">Apellido paterno</Label>
                <Input
                  id="searchPaterno"
                  placeholder="Apellido paterno..."
                  value={filters.searchPaterno}
                  onChange={(e) =>
                    handleFilterChange("searchPaterno", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="searchMaterno">Apellido materno</Label>
                <Input
                  id="searchMaterno"
                  placeholder="Apellido materno..."
                  value={filters.searchMaterno}
                  onChange={(e) =>
                    handleFilterChange("searchMaterno", e.target.value)
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="searchActivo">Buscar por activo</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="searchActivo"
                    placeholder="Código, descripción o serie..."
                    className="pl-8"
                    value={filters.searchActivo}
                    onChange={(e) =>
                      handleFilterChange("searchActivo", e.target.value)
                    }
                  />
                </div>
              </div>

              <ComboboxField
                label="Buscar por grupo"
                value={filters.searchGrupo}
                onValueChange={(value) =>
                  handleFilterChange("searchGrupo", value)
                }
                options={[
                  { value: "__todos__", label: "Todos los grupos" },
                  ...rubros.map((r) => ({
                    value: r.descripcionrubroact,
                    label: r.descripcionrubroact,
                  })),
                ]}
                placeholder="Seleccionar grupo"
                searchPlaceholder="Buscar grupo..."
              />

              <div className="space-y-2">
                <Label htmlFor="estado">Buscar por estado</Label>
                <Select
                  value={filters.estado}
                  onValueChange={(value) => handleFilterChange("estado", value)}
                >
                  <SelectTrigger id="estado">
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    {ESTADOS.map((est) => (
                      <SelectItem key={est} value={est}>
                        {est}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Lista de Asignaciones
            {totalCount > 0 && (
              <span className="text-sm font-normal text-muted-foreground ml-auto">
                {totalCount} registro(s)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código Activo</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Serie</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Tipo Grupo</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead>CI</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {asignaciones.length > 0 ? (
                  asignaciones.map((a) => (
                    <TableRow key={a.idbien}>
                      <TableCell className="font-medium whitespace-normal break-words max-w-[180px]">
                        {a.codigoactivo || "—"}
                      </TableCell>
                      <TableCell className="whitespace-normal break-words max-w-[250px]">
                        {a.descripcionactivo || "—"}
                      </TableCell>
                      <TableCell className="whitespace-normal break-words max-w-[120px]">
                        {a.serie || "—"}
                      </TableCell>
                      <TableCell className="whitespace-normal break-words max-w-[150px]">
                        {a.marcamaterial || "—"}
                      </TableCell>
                      <TableCell className="whitespace-normal break-words max-w-[150px]">
                        {a.grupo || "—"}
                      </TableCell>
                      <TableCell className="whitespace-normal break-words max-w-[150px]">
                        {a.tipogrupo || "—"}
                      </TableCell>
                      <TableCell className="font-medium whitespace-normal break-words max-w-[180px]">
                        {getNombreCompleto(a)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {a.cirun || "—"}
                      </TableCell>
                      <TableCell className="whitespace-normal break-words max-w-[150px]">
                        {a.cargoresponsable || "—"}
                      </TableCell>
                      <TableCell className="whitespace-normal break-words max-w-[200px]">
                        {[a.descripcion, a.inmueble, a.nivel, a.ambiente]
                          .filter(Boolean)
                          .join(" - ") || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            (a.estado || "") === "Activo"
                              ? "default"
                              : "secondary"
                          }
                          className={
                            a.estado === "Baja"
                              ? "bg-gray-100 text-gray-600 hover:bg-gray-100"
                              : ""
                          }
                        >
                          {a.estado || "Desconocido"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={11}
                      className="text-center py-12 text-muted-foreground"
                    >
                      <ClipboardList className="mx-auto h-12 w-12 opacity-20 mb-2" />
                      <p className="text-lg font-medium">
                        {hasActiveFilters
                          ? "No se encontraron asignaciones que coincidan con los filtros"
                          : "Usa los filtros para buscar asignaciones"}
                      </p>
                      <p className="text-sm mt-1">
                        {hasActiveFilters
                          ? "Intenta ajustar los filtros de búsqueda"
                          : ""}
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {showPagination && (
            <DataPagination
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AsignacionesList;
