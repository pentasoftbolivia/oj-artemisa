import { useState, useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import {
  ArrowLeft,
  Edit,
  Filter,
  Package,
  Search,
  X,
  Plus,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { selectUser } from "@/store/auth/authSlice";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import LoadingSpinner from "@/components/ui/loading-spinner";

import InventarioFilters from "../components/InventarioFilters";
import InventarioTable from "../components/InventarioTable";
import DataPagination from "@/components/ui/data-pagination";

import { useInventarioData } from "../hooks/useInventarioData";
import {
  getRubroFields,
  normalizeCi,
  normalizeCiLoose,
  getCiPrefix,
  BASE_EDIT_FIELDS,
} from "../constants/inventarioConstants";
import {
  InventarioEditModal,
  InventarioImagesModal,
} from "../components/InventarioModals";

const PAGE_SIZE = 100;
const TOTAL_ACTIVOS = 43310;

const InventarioList = () => {
  const { toast } = useToast();
  const currentUser = useSelector(selectUser);

  const {
    isLoading,
    activos,
    setActivos,
    rubros,
    tipoRubros,
    ambientes,
    directAmbMap,
    directRespMap,
    ambientesRef,
    responsablesRef,
    directAmbRef,
    directRespRef,
    rubroDescMap,
    rubroFromTipo,
    tipoRubroDescMap,
    inventariadorStats,
    ambienteMap,
    responsableMap,
    loadActivos,
    loadInitialData,
  } = useInventarioData();

  const [showSearch, setShowSearch] = useState(false);
  const [filtroCodigoActivo, setFiltroCodigoActivo] = useState("");
  const [filtroInventariador, setFiltroInventariador] = useState("");
  const [filtroCarnet, setFiltroCarnet] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("all");

  const [searchCarnet, setSearchCarnet] = useState("");
  const [searchNombre, setSearchNombre] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const [editActivo, setEditActivo] = useState(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedActivoImages, setSelectedActivoImages] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);
  const [isLoadingImages, setIsLoadingImages] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (rubros.length > 0 && tipoRubros.length > 0) {
      loadActivos({});
    }
  }, [rubros, tipoRubros, loadActivos]);

  const handleFilter = () => {
    setCurrentPage(1);
    loadActivos({
      codigoActivo: filtroCodigoActivo,
      inventariador: filtroInventariador,
      carnet: filtroCarnet,
    });
  };

  const clearFilters = () => {
    setCurrentPage(1);
    setFiltroCodigoActivo("");
    setFiltroInventariador("");
    setFiltroCarnet("");
    setFiltroEstado("all");
    loadActivos({});
  };

  const handleSearch = () => {
    setCurrentPage(1);
    loadActivos({ carnet: searchCarnet, nombre: searchNombre, all: true });
  };

  const clearSearch = () => {
    setCurrentPage(1);
    setSearchCarnet("");
    setSearchNombre("");
    loadActivos({});
  };

  const getConservacion = (a) => {
    const val =
      a.estadoConservacion ??
      a.estadoconservacion ??
      a.estado_conservacion ??
      "";
    return String(val).trim().toUpperCase();
  };

  const handleEdit = (activo) => {
    const rubroDesc = rubroFromTipo[activo.tipoRubroAct] || "";
    const tipoDesc = tipoRubroDescMap[activo.tipoRubroAct] || "";
    const consVal = getConservacion(activo);
    setEditActivo(activo);
    setEditForm({
      codigoActivo:
        activo.codigoActivo != null ? String(activo.codigoActivo) : "",
      rubro: rubroDesc,
      tipoRubro: tipoDesc,
      descripcionActivo: (activo.descripcionActivo || "").trim(),
      codigoAmbiente: String(activo.codigoAmbiente ?? "").trim(),
      estadoConservacion: consVal,
      marcamaterial:
        activo.marcaMaterial != null
          ? String(activo.marcaMaterial)
          : activo.marcamaterial != null
            ? String(activo.marcamaterial)
            : "",
      modelo: activo.modelo != null ? String(activo.modelo) : "",
      serie: activo.serie != null ? String(activo.serie) : "",
      ...getRubroFieldValues(activo, rubroDesc),
    });
    setIsEditOpen(true);
  };

  const getRubroFieldValues = (activo, rubroDesc) => {
    const fields = getRubroFields(rubroDesc);
    const values = {};
    fields.forEach((f) => {
      values[f.key] = activo[f.key] != null ? String(activo[f.key]) : "";
    });
    return values;
  };

  const getEditFieldsForRubro = (rubroDesc) => {
    return getRubroFields(rubroDesc);
  };

  const handleEditChange = (e) => {
    const { id, value } = e.target;
    setEditForm((p) => ({ ...p, [id]: value }));
  };

  const handleEditSelectChange = (field, value) => {
    setEditForm((p) => ({ ...p, [field]: value }));
  };

  const handleEditSave = async () => {
    if (!editActivo) return;
    setIsSaving(true);
    try {
      const rubroDesc = rubroFromTipo[editActivo.tipoRubroAct] || "";
      const fieldsToUpdate = {};
      fieldsToUpdate.descripcionactivo = editForm.descripcionActivo;
      const ambValue = editForm.codigoAmbiente;
      if (ambValue) fieldsToUpdate.codigoambiente = ambValue;
      const rubroFields = getEditFieldsForRubro(rubroDesc);
      if (editForm.estadoConservacion) {
        fieldsToUpdate.estadoconservacion = editForm.estadoConservacion;
      }
      fieldsToUpdate.marcamaterial = editForm.marcamaterial || null;
      fieldsToUpdate.modelo = editForm.modelo || null;
      fieldsToUpdate.serie = editForm.serie || null;
      rubroFields.forEach((f) => {
        const val = editForm[f.key];
        fieldsToUpdate[f.key] = val || null;
      });

      if (showSearch) {
        fieldsToUpdate.estado = 1;
      }

      const { error } = await supabase
        .from("act_activos")
        .update(fieldsToUpdate)
        .eq("codigoactivointerno", editActivo.codigoActivoInterno);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Activo actualizado correctamente.",
      });
      setIsEditOpen(false);
      setEditActivo(null);
      loadActivos({
        codigoActivo: filtroCodigoActivo,
        inventariador: filtroInventariador,
        carnet: filtroCarnet,
      });
    } catch (err) {
      toast({
        title: "Error",
        description: `Error al actualizar: ${err.message} ${err.details || ""} ${err.hint || ""}`,
        variant: "destructive",
      });
      console.error("Supabase error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegistrar = async () => {
    if (!editActivo) return;
    const confirmed = window.confirm(
      "¿Está seguro de registrar y transferir la información?",
    );
    if (!confirmed) return;
    setIsSaving(true);
    try {
      const rubroDesc = rubroFromTipo[editActivo.tipoRubroAct] || "";
      const rubroFields = getEditFieldsForRubro(rubroDesc);
      const userEmail = currentUser?.email || "unknown";

      const { error: updateError } = await supabase
        .from("act_activos")
        .update({ ultimoregistro: 0, estadoinventario: "INVENTARIADO" })
        .eq("codigoactivointerno", editActivo.codigoActivoInterno);

      if (updateError) throw updateError;

      const newRecord = {
        codigoactivo: editActivo.codigoActivo,
        codigotransaccion: editActivo.codigoTransaccion,
        codigoambiente: editForm.codigoAmbiente || editActivo.codigoAmbiente,
        cirun: editActivo.cirun,
        descripcionactivo: editForm.descripcionActivo,
        tiporubroact: editActivo.tipoRubroAct,
        serie: editActivo.serie,
        marcamaterial: editActivo.marcaMaterial,
        estado: editActivo.estado,
        observaciones: editActivo.observaciones,
        valoractual: editActivo.valorActual,
        ultimoregistro: 1,
        estadoconservacion:
          editForm.estadoConservacion || editActivo.estadoconservacion,
        usuarioinventario: userEmail,
        estadoinventario: "PENDIENTE",
      };

      rubroFields.forEach((f) => {
        const val = editForm[f.key];
        if (val) newRecord[f.key] = val;
      });

      const { error: insertError } = await supabase
        .from("act_activos")
        .insert(newRecord);

      if (insertError) throw insertError;

      toast({
        title: "Éxito",
        description: "Activo registrado y transferido correctamente.",
      });
      setIsEditOpen(false);
      setEditActivo(null);
      loadActivos({ carnet: searchCarnet, nombre: searchNombre, all: true });
    } catch (err) {
      toast({
        title: "Error",
        description: `Error al registrar: ${err.message} ${err.details || ""} ${err.hint || ""}`,
        variant: "destructive",
      });
      console.error("Supabase error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAprobado = async (activo) => {
    try {
      const isRevisado = activo.estadoinventario === "REVISADO";
      const updateData = isRevisado
        ? { estadoinventario: "INVENTARIADO", aprobadorinventario: null }
        : {
            estadoinventario: "REVISADO",
            aprobadorinventario: currentUser?.email || "unknown",
          };

      const { error } = await supabase
        .from("act_activos")
        .update(updateData)
        .eq("codigoactivointerno", activo.codigoActivoInterno);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: isRevisado
          ? "Estado de inventario cambiado a INVENTARIADO."
          : "Estado de inventario cambiado a REVISADO.",
      });
      setActivos((prev) =>
        prev.map((a) =>
          a.codigoActivoInterno === activo.codigoActivoInterno
            ? { ...a, ...updateData }
            : a,
        ),
      );
    } catch (err) {
      toast({
        title: "Error",
        description: `Error al actualizar: ${err.message}`,
        variant: "destructive",
      });
    }
  };

  const handleEnviar = async (activo) => {
    try {
      const { error } = await supabase
        .from("act_activos")
        .update({ estadoinventario: "ENVIADO" })
        .eq("codigoactivointerno", activo.codigoActivoInterno);

      if (error) throw error;

      toast({ title: "Éxito", description: "Estado cambiado a ENVIADO." });
      setActivos((prev) =>
        prev.map((a) =>
          a.codigoActivoInterno === activo.codigoActivoInterno
            ? { ...a, estadoinventario: "ENVIADO" }
            : a,
        ),
      );
    } catch (err) {
      toast({
        title: "Error",
        description: `Error al actualizar: ${err.message}`,
        variant: "destructive",
      });
    }
  };

  const handleOpenImages = async (activo) => {
    setSelectedActivoImages(activo);
    setIsLoadingImages(true);
    setIsImageModalOpen(true);
    const prefix = `${activo.codigoActivo}_`;
    const { data, error } = await supabase.storage
      .from("imagenes")
      .list("", { search: prefix, sortBy: { column: "name", order: "asc" } });
    if (!error && data) {
      const files = data
        .filter((f) => f.name.startsWith(prefix))
        .map((f) => ({
          name: f.name,
          url: supabase.storage.from("imagenes").getPublicUrl(f.name).data
            .publicUrl,
        }));
      setImageFiles(files);
    } else {
      setImageFiles([]);
    }
    setIsLoadingImages(false);
  };

  const renderEditFields = () => {
    if (!editActivo) return null;
    const rubroDesc = rubroFromTipo[editActivo.tipoRubroAct] || "";
    const fields = getEditFieldsForRubro(rubroDesc);

    return fields.map((f) => (
      <div key={f.key} className="space-y-2">
        <Label htmlFor={f.key}>{f.label}</Label>
        <Input
          id={f.key}
          value={editForm[f.key] || ""}
          onChange={handleEditChange}
          disabled={isSaving}
        />
      </div>
    ));
  };

  const ambMap =
    Object.keys(directAmbMap).length > 0 ? directAmbMap : directAmbRef.current;
  const ambCatMap =
    Object.keys(ambienteMap).length > 0
      ? ambienteMap
      : (() => {
          const m = {};
          ambientesRef.current.forEach((a) => {
            const c = String(a.codigoambiente ?? "").trim();
            if (c) m[c] = a.ambiente;
          });
          return m;
        })();

  const getAmbienteName = (code) => {
    const c = String(code ?? "").trim();
    return ambMap[c] ?? ambCatMap[c] ?? (c || "—");
  };

  const respMap =
    Object.keys(directRespMap).length > 0
      ? directRespMap
      : directRespRef.current;
  const respCatMap =
    Object.keys(responsableMap).length > 0
      ? responsableMap
      : (() => {
          const m = {};
          (responsablesRef.current || []).forEach((r) => {
            const raw = String(r.cirun ?? "").trim();
            m[raw] = r;
            const norm = normalizeCi(r.cirun);
            if (norm !== raw) m[norm] = r;
            const loose = normalizeCiLoose(r.cirun);
            if (loose !== raw && loose !== norm) m[loose] = r;
            const prefix = getCiPrefix(raw);
            if (prefix && prefix !== raw && prefix !== norm && prefix !== loose)
              m[prefix] = r;
          });
          return m;
        })();

  const getResponsableName = (cirun) => {
    const rawCi = String(cirun ?? "").trim();
    if (!rawCi) return "—";
    const normCi = normalizeCi(rawCi);
    const looseCi = normalizeCiLoose(rawCi);
    const prefixCi = getCiPrefix(rawCi);
    const resp =
      respMap[normCi] ||
      respMap[looseCi] ||
      respMap[prefixCi] ||
      respMap[rawCi] ||
      respCatMap[normCi] ||
      respCatMap[looseCi] ||
      respCatMap[prefixCi] ||
      respCatMap[rawCi];
    return resp
      ? [resp.nombre1, resp.nombre2, resp.paterno, resp.materno]
          .map((s) => (s || "").trim())
          .filter(Boolean)
          .join(" ") || resp.cirun
      : rawCi || "—";
  };

  const resolvedActivos = useMemo(() => {
    const mapped = activos.map((a) => {
      const tipoRubro = tipoRubros.find(
        (t) => String(t.tiporubroact) === String(a.tipoRubroAct),
      );
      const rubroDesc =
        rubroDescMap[tipoRubro?.codigorubroact] ??
        rubroDescMap[String(tipoRubro?.codigorubroact)] ??
        "—";
      const tipoDesc =
        tipoRubroDescMap[a.tipoRubroAct] ??
        tipoRubroDescMap[String(a.tipoRubroAct)] ??
        "—";
      const ambCode = String(a.codigoAmbiente ?? "").trim();
      const amb =
        directAmbMap[ambCode] ?? ambienteMap[ambCode] ?? (ambCode || "—");
      const rawCi = String(a.cirun ?? "").trim();
      const normCi = normalizeCi(rawCi);
      const looseCi = normalizeCiLoose(rawCi);
      const prefixCi = getCiPrefix(rawCi);
      const resp =
        directRespMap[normCi] ||
        directRespMap[looseCi] ||
        directRespMap[prefixCi] ||
        directRespMap[rawCi] ||
        responsableMap[normCi] ||
        responsableMap[looseCi] ||
        responsableMap[prefixCi] ||
        responsableMap[rawCi];
      const respName = resp
        ? [resp.nombre1, resp.nombre2, resp.paterno, resp.materno]
            .map((s) => (s || "").trim())
            .filter(Boolean)
            .join(" ") || resp.cirun
        : rawCi || "—";
      const circache = rawCi;
      const ambCodeCache = ambCode;
      return {
        ...a,
        _codigoActivo: a.codigoActivo != null ? `OJ-02-${a.codigoActivo}` : "",
        _rubro: rubroDesc,
        _tipoRubro: tipoDesc,
        _ambiente: amb,
        _responsableName: respName,
        _carnetResponsable: a.cirun || "—",
        _ci: circache,
        _ambienteKey: ambCodeCache,
      };
    });
    return mapped.sort((a, b) => b.codigoActivoInterno - a.codigoActivoInterno);
  }, [
    activos,
    rubroDescMap,
    tipoRubroDescMap,
    ambienteMap,
    responsableMap,
    tipoRubros,
    directAmbMap,
    directRespMap,
  ]);

  const filteredActivos = useMemo(() => {
    if (filtroEstado === "all") return resolvedActivos;
    return resolvedActivos.filter((a) => {
      if (filtroEstado === "revisado")
        return a.estadoinventario === "REVISADO";
      if (filtroEstado === "pendiente")
        return a.estadoinventario !== "REVISADO";
      return true;
    });
  }, [resolvedActivos, filtroEstado]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredActivos.length / pageSize)),
    [filteredActivos.length, pageSize],
  );
  const safeCurrentPage = useMemo(
    () => Math.min(currentPage, totalPages),
    [currentPage, totalPages],
  );
  const paginatedData = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredActivos.slice(start, start + pageSize);
  }, [filteredActivos, safeCurrentPage, pageSize]);

  const totalStats = useMemo(() => {
    let revisados = 0;
    activos.forEach((a) => {
      const est = String(a.estadoinventario || "").toUpperCase();
      if (est === "REVISADO") revisados++;
    });
    return {
      total: activos.length,
      revisados,
      noRevisados: activos.length - revisados,
      progreso: (activos.length / TOTAL_ACTIVOS) * 100,
    };
  }, [activos]);

  const progressLevel = useMemo(() => {
    if (totalStats.progreso >= 80) return "high";
    if (totalStats.progreso >= 50) return "mid";
    return "low";
  }, [totalStats.progreso]);

  const progressStyles = {
    low: {
      background:
        "linear-gradient(180deg, #ef4444 0%, #dc2626 45%, #b91c1c 100%)",
      borderColor: "#991b1b",
      textColor: "#fff",
      textShadow: "2px 2px 4px rgba(0, 0, 0, 0.4)",
      titleShadow: "0 2px 0 #7f1d1d, 0 4px 6px rgba(0, 0, 0, 0.5)",
    },
    mid: {
      background:
        "linear-gradient(180deg, #fde047 0%, #facc15 45%, #ca8a04 100%)",
      borderColor: "#a16207",
      textColor: "#000",
      textShadow: "1px 1px 2px rgba(0, 0, 0, 0.25)",
      titleShadow: "0 2px 0 #a16207, 0 4px 6px rgba(0, 0, 0, 0.35)",
    },
    high: {
      background:
        "linear-gradient(180deg, #4ade80 0%, #22c55e 45%, #15803d 100%)",
      borderColor: "#166534",
      textColor: "#fff",
      textShadow: "2px 2px 4px rgba(0, 0, 0, 0.4)",
      titleShadow: "0 2px 0 #14532d, 0 4px 6px rgba(0, 0, 0, 0.5)",
    },
  };
  const progressStyle = progressStyles[progressLevel];

  if (isLoading && activos.length === 0 && rubros.length === 0) {
    return <LoadingSpinner />;
  }

  if (showSearch) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setShowSearch(false)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              LISTA DE ACTIVOS POR BUSQUEDA
            </h1>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="searchCarnet">Carnet del Responsable</Label>
                <Input
                  id="searchCarnet"
                  placeholder="Buscar por carnet..."
                  value={searchCarnet}
                  onChange={(e) => setSearchCarnet(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="searchNombre">
                  Nombres o Apellidos del Responsable
                </Label>
                <Input
                  id="searchNombre"
                  placeholder="Buscar por nombre o apellido..."
                  value={searchNombre}
                  onChange={(e) => setSearchNombre(e.target.value)}
                />
              </div>
              <div className="space-y-2 flex items-end gap-2">
                <Button onClick={handleSearch}>
                  <Search className="h-4 w-4 mr-2" />
                  Buscar
                </Button>
                <Button
                  variant="outline"
                  onClick={clearSearch}
                  disabled={!searchCarnet && !searchNombre}
                >
                  <X className="h-4 w-4 mr-2" />
                  Limpiar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4" />
              Resultados de Búsqueda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código Activo</TableHead>
                    <TableHead>Rubro</TableHead>
                    <TableHead>Tipo Rubro</TableHead>
                    <TableHead>Descripción del Activo</TableHead>
                    <TableHead>Ambiente</TableHead>
                    <TableHead>Responsable</TableHead>
                    <TableHead>CI</TableHead>
                    {currentUser?.role !== "Usuario" && (
                      <TableHead className="text-center">Acciones</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.length > 0 ? (
                    paginatedData.map((a) => (
                      <TableRow key={a.codigoActivoInterno}>
                        <TableCell className="font-mono text-xs">
                          {a._codigoActivo}
                        </TableCell>
                        <TableCell className="font-mono text-xs whitespace-normal break-words max-w-[180px]">
                          {a._rubro}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {a._tipoRubro}
                        </TableCell>
                        <TableCell className="whitespace-normal break-words max-w-[250px]">
                          {a.descripcionActivo}
                        </TableCell>
                        <TableCell className="font-mono text-xs whitespace-normal break-words max-w-[200px]">
                          {getAmbienteName(a._ambienteKey)}
                        </TableCell>
                        <TableCell className="font-mono text-xs whitespace-normal break-words max-w-[200px]">
                          {getResponsableName(a._ci)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {a._carnetResponsable}
                        </TableCell>
                        {currentUser?.role !== "Usuario" && (
                          <TableCell className="text-right">
                            <div className="flex space-x-1 justify-end">
                              {a.ultimoregistro !== 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(a)}
                                  className="text-yellow-500 hover:text-yellow-700"
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  EDITAR
                                </Button>
                              )}
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleEnviar(a)}
                                className={
                                  a.ultimoregistro === 0 ||
                                  a.estadoinventario === "ENVIADO"
                                    ? "bg-orange-500 hover:bg-orange-600 text-white font-bold"
                                    : "bg-red-600 hover:bg-red-700 text-white font-bold"
                                }
                              >
                                {a.ultimoregistro === 0 ||
                                a.estadoinventario === "ENVIADO"
                                  ? "ENVIADO"
                                  : "PENDIENTE"}
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center py-12 text-muted-foreground"
                      >
                        <Package className="mx-auto h-12 w-12 opacity-20 mb-2" />
                        <p className="text-lg font-medium">
                          {isLoading
                            ? "Cargando..."
                            : "No se encontraron activos"}
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {resolvedActivos.length > 0 && (
              <DataPagination
                currentPage={safeCurrentPage}
                totalPages={totalPages}
                totalCount={resolvedActivos.length}
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

        <Dialog
          open={isEditOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsEditOpen(false);
              setEditActivo(null);
            }
          }}
        >
          <DialogContent
            className="sm:max-w-[600px]"
            onInteractOutside={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>Editar Activo</DialogTitle>
              <DialogDescription>
                Modifica los datos del activo fijo
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
              {BASE_EDIT_FIELDS.map((f) => {
                if (f.type === "select") {
                  return (
                    <div key={f.key} className="space-y-2">
                      <Label htmlFor={f.key}>{f.label}</Label>
                      <Select
                        value={editForm.codigoAmbiente}
                        onValueChange={(v) =>
                          handleEditSelectChange("codigoAmbiente", v)
                        }
                        disabled={isSaving}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Seleccionar ambiente" />
                        </SelectTrigger>
                        <SelectContent>
                          {ambientes.map((a) => (
                            <SelectItem
                              key={a.codigoambiente}
                              value={String(a.codigoambiente).trim()}
                            >
                              {`${a.codigoambiente} - ${a.ambiente}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                }
                return (
                  <div key={f.key} className="space-y-2">
                    <Label htmlFor={f.key}>{f.label}</Label>
                    <Input
                      id={f.key}
                      value={editForm[f.key] || ""}
                      onChange={f.readonly ? undefined : handleEditChange}
                      disabled={isSaving || f.readonly}
                      readOnly={f.readonly}
                    />
                  </div>
                );
              })}

              <div className="border-t pt-4 mt-2">
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                  Estado de Conservación
                </h3>
                <Select
                  value={editForm.estadoConservacion}
                  onValueChange={(v) =>
                    handleEditSelectChange("estadoConservacion", v)
                  }
                  disabled={isSaving}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BUENO">BUENO</SelectItem>
                    <SelectItem value="REGULAR">REGULAR</SelectItem>
                    <SelectItem value="MALO">MALO</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="border-t pt-4 mt-2">
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                  Características
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="marcamaterial">Marca Material</Label>
                    <Input
                      id="marcamaterial"
                      value={editForm.marcamaterial || ""}
                      onChange={handleEditChange}
                      disabled={isSaving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="modelo">Modelo</Label>
                    <Input
                      id="modelo"
                      value={editForm.modelo || ""}
                      onChange={handleEditChange}
                      disabled={isSaving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="serie">Serie</Label>
                    <Input
                      id="serie"
                      value={editForm.serie || ""}
                      onChange={handleEditChange}
                      disabled={isSaving}
                    />
                  </div>
                </div>
              </div>

              {editActivo && rubroFromTipo[editActivo.tipoRubroAct] && (
                <div className="border-t pt-4 mt-2">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                    Campos específicos: {rubroFromTipo[editActivo.tipoRubroAct]}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderEditFields()}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditOpen(false);
                  setEditActivo(null);
                }}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button onClick={handleRegistrar} disabled={isSaving}>
                {isSaving ? "Guardando..." : "REGISTRAR"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            PANEL DE CONTROL INVENTARIO
          </h1>
          <p className="text-muted-foreground">
            Gestión de inventario de activos fijos
          </p>
        </div>
        {currentUser?.role !== "Usuario" && (
          <Button
            onClick={() => {
              setShowSearch(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            NUEVO
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle
            className="text-lg font-bold flex items-center gap-2 tracking-wide"
            style={{ textShadow: "1px 1px 2px rgba(0, 0, 0, 0.35)" }}
          >
            <Package className="h-4 w-4" />
            RESUMEN DE TOTALES
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border border-blue-200 dark:border-blue-900 border-b-4 border-b-blue-400 dark:border-b-blue-700 p-4 bg-blue-50 dark:bg-blue-950/20 text-center shadow-lg shadow-blue-200/60 dark:shadow-blue-950/40">
              <div
                className="text-base font-bold text-blue-600 dark:text-blue-400 tracking-wide"
                style={{ textShadow: "1px 1px 2px rgba(37, 99, 235, 0.35)" }}
              >
                TOTAL ACTIVOS INVENTARIADOS
              </div>
              <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                {totalStats.total}
              </div>
            </div>
            <div className="rounded-lg border border-red-200 dark:border-red-900 border-b-4 border-b-red-400 dark:border-b-red-700 p-4 bg-red-50 dark:bg-red-950/20 text-center shadow-lg shadow-red-200/60 dark:shadow-red-950/40">
              <div
                className="text-base font-bold text-red-600 dark:text-red-400 tracking-wide"
                style={{ textShadow: "1px 1px 2px rgba(220, 38, 38, 0.35)" }}
              >
                NO REVISADOS
              </div>
              <div className="text-3xl font-bold text-red-700 dark:text-red-300">
                {totalStats.noRevisados}
              </div>
            </div>
            <div className="rounded-lg border border-yellow-200 dark:border-yellow-900 border-b-4 border-b-yellow-400 dark:border-b-yellow-700 p-4 bg-yellow-50 dark:bg-yellow-950/20 text-center shadow-lg shadow-yellow-200/60 dark:shadow-yellow-950/40">
              <div
                className="text-base font-bold text-yellow-600 dark:text-yellow-400 tracking-wide"
                style={{ textShadow: "1px 1px 2px rgba(202, 138, 4, 0.35)" }}
              >
                REVISADOS
              </div>
              <div className="text-3xl font-bold text-yellow-700 dark:text-yellow-300">
                {totalStats.revisados}
              </div>
            </div>
          </div>

          <div
            className="mt-6 rounded-xl border-2 p-6 text-center"
            style={{
              background: progressStyle.background,
              borderColor: progressStyle.borderColor,
              boxShadow:
                "inset 0 3px 0 rgba(255,255,255,0.3), inset 0 -7px 0 rgba(0,0,0,0.2), 0 14px 28px rgba(0,0,0,0.35)",
            }}
          >
            <div
              className="text-3xl font-black tracking-widest"
              style={{
                color: progressStyle.textColor,
                textShadow: progressStyle.titleShadow,
              }}
            >
              PROGRESO
            </div>
            <div
              className="text-5xl font-extrabold mt-2 animate-flash"
              style={{
                color: progressStyle.textColor,
                textShadow: progressStyle.textShadow,
              }}
            >
              {totalStats.progreso.toFixed(2)}%
            </div>
            {progressLevel === "low" && (
              <div className="mt-3" title="No has llegado al 50%">
                <svg
                  width="80"
                  height="80"
                  viewBox="0 0 100 100"
                  className="inline-block"
                >
                  <defs>
                    <radialGradient id="faceGrad" cx="40%" cy="30%" r="80%">
                      <stop offset="0%" stopColor="#ffe3b3" />
                      <stop offset="55%" stopColor="#f7b267" />
                      <stop offset="100%" stopColor="#df8a3c" />
                    </radialGradient>
                    <filter
                      id="faceShadow"
                      x="-20%"
                      y="-20%"
                      width="140%"
                      height="140%"
                    >
                      <feDropShadow
                        dx="0"
                        dy="5"
                        stdDeviation="4"
                        floodColor="#000"
                        floodOpacity="0.35"
                      />
                    </filter>
                  </defs>
                  <g filter="url(#faceShadow)">
                    <circle cx="50" cy="47" r="40" fill="url(#faceGrad)" />
                    <circle
                      cx="50"
                      cy="47"
                      r="40"
                      fill="none"
                      stroke="#c96f2e"
                      strokeWidth="2"
                    />
                    <ellipse
                      cx="50"
                      cy="80"
                      rx="34"
                      ry="10"
                      fill="#000"
                      opacity="0.12"
                    />
                  </g>
                  <path
                    d="M 20 32 L 43 42"
                    stroke="#4a2c14"
                    strokeWidth="7"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <path
                    d="M 80 32 L 57 42"
                    stroke="#4a2c14"
                    strokeWidth="7"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <ellipse cx="33" cy="50" rx="7" ry="9" fill="#fff" />
                  <circle cx="33" cy="51" r="4" fill="#2b1a0f" />
                  <ellipse cx="67" cy="50" rx="7" ry="9" fill="#fff" />
                  <circle cx="67" cy="51" r="4" fill="#2b1a0f" />
                  <path
                    d="M 34 70 Q 50 60 66 70 Q 50 75 34 70 Z"
                    fill="#7c2d12"
                  />
                </svg>
              </div>
            )}
            {progressLevel === "mid" && (
              <div className="mt-3" title="Has llegado al 50%">
                <svg
                  width="80"
                  height="80"
                  viewBox="0 0 100 100"
                  className="inline-block"
                >
                  <defs>
                    <radialGradient id="faceGrad" cx="40%" cy="30%" r="80%">
                      <stop offset="0%" stopColor="#ffe3b3" />
                      <stop offset="55%" stopColor="#f7b267" />
                      <stop offset="100%" stopColor="#df8a3c" />
                    </radialGradient>
                    <filter
                      id="faceShadow"
                      x="-20%"
                      y="-20%"
                      width="140%"
                      height="140%"
                    >
                      <feDropShadow
                        dx="0"
                        dy="5"
                        stdDeviation="4"
                        floodColor="#000"
                        floodOpacity="0.35"
                      />
                    </filter>
                  </defs>
                  <g filter="url(#faceShadow)">
                    <circle cx="50" cy="47" r="40" fill="url(#faceGrad)" />
                    <circle
                      cx="50"
                      cy="47"
                      r="40"
                      fill="none"
                      stroke="#c96f2e"
                      strokeWidth="2"
                    />
                    <ellipse
                      cx="50"
                      cy="80"
                      rx="34"
                      ry="10"
                      fill="#000"
                      opacity="0.12"
                    />
                  </g>
                  <path
                    d="M 22 36 L 44 36"
                    stroke="#4a2c14"
                    strokeWidth="6"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <path
                    d="M 56 36 L 78 36"
                    stroke="#4a2c14"
                    strokeWidth="6"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <ellipse cx="33" cy="50" rx="7" ry="9" fill="#fff" />
                  <circle cx="33" cy="51" r="4" fill="#2b1a0f" />
                  <ellipse cx="67" cy="50" rx="7" ry="9" fill="#fff" />
                  <circle cx="67" cy="51" r="4" fill="#2b1a0f" />
                  <path
                    d="M 34 72 L 66 72"
                    stroke="#7c2d12"
                    strokeWidth="6"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              </div>
            )}
            {progressLevel === "high" && (
              <div className="mt-3" title="Has llegado al 80%">
                <svg
                  width="80"
                  height="80"
                  viewBox="0 0 100 100"
                  className="inline-block"
                >
                  <defs>
                    <radialGradient id="faceGrad" cx="40%" cy="30%" r="80%">
                      <stop offset="0%" stopColor="#ffe3b3" />
                      <stop offset="55%" stopColor="#f7b267" />
                      <stop offset="100%" stopColor="#df8a3c" />
                    </radialGradient>
                    <filter
                      id="faceShadow"
                      x="-20%"
                      y="-20%"
                      width="140%"
                      height="140%"
                    >
                      <feDropShadow
                        dx="0"
                        dy="5"
                        stdDeviation="4"
                        floodColor="#000"
                        floodOpacity="0.35"
                      />
                    </filter>
                  </defs>
                  <g filter="url(#faceShadow)">
                    <circle cx="50" cy="47" r="40" fill="url(#faceGrad)" />
                    <circle
                      cx="50"
                      cy="47"
                      r="40"
                      fill="none"
                      stroke="#c96f2e"
                      strokeWidth="2"
                    />
                    <ellipse
                      cx="50"
                      cy="80"
                      rx="34"
                      ry="10"
                      fill="#000"
                      opacity="0.12"
                    />
                  </g>
                  <path
                    d="M 20 34 Q 30 28 40 33"
                    stroke="#4a2c14"
                    strokeWidth="6"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <path
                    d="M 60 33 Q 70 28 80 34"
                    stroke="#4a2c14"
                    strokeWidth="6"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <path
                    d="M 27 48 Q 33 43 39 48"
                    stroke="#4a2c14"
                    strokeWidth="5"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <path
                    d="M 61 48 Q 67 43 73 48"
                    stroke="#4a2c14"
                    strokeWidth="5"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <ellipse cx="34" cy="62" rx="9" ry="5" fill="#f59e0b" opacity="0.4" />
                  <ellipse cx="66" cy="62" rx="9" ry="5" fill="#f59e0b" opacity="0.4" />
                  <path
                    d="M 32 68 Q 50 88 68 68 Q 58 74 50 74 Q 42 74 32 68 Z"
                    fill="#7c2d12"
                  />
                </svg>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {inventariadorStats.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" />
              Resumen por Inventariador
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {inventariadorStats.map((stat) => (
                <div
                  key={stat.email}
                  className="rounded-lg border p-4 bg-muted/20 space-y-2"
                >
                  <div
                    className="text-xs font-semibold truncate text-muted-foreground"
                    title={stat.email}
                  >
                    {stat.email}
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded p-2 text-center">
                      <div className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                        Pendientes
                      </div>
                      <div className="text-lg font-bold text-orange-700 dark:text-orange-300">
                        {stat.pendiente}
                      </div>
                    </div>
                    <div className="flex-1 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded p-2 text-center">
                      <div className="text-xs text-green-600 dark:text-green-400 font-medium">
                        Revisados
                      </div>
                      <div className="text-lg font-bold text-green-700 dark:text-green-300">
                        {stat.revisado}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <InventarioFilters
        filtroCodigoActivo={filtroCodigoActivo}
        setFiltroCodigoActivo={setFiltroCodigoActivo}
        filtroInventariador={filtroInventariador}
        setFiltroInventariador={setFiltroInventariador}
        filtroCarnet={filtroCarnet}
        setFiltroCarnet={setFiltroCarnet}
        filtroEstado={filtroEstado}
        setFiltroEstado={setFiltroEstado}
        onFilter={handleFilter}
        onClearFilters={clearFilters}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" />
            Control de Activos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <InventarioTable
            data={paginatedData}
            isLoading={isLoading}
            getAmbienteName={getAmbienteName}
            getResponsableName={getResponsableName}
            onEdit={handleEdit}
            onOpenImages={handleOpenImages}
            onToggleAprobado={handleToggleAprobado}
            currentUser={currentUser}
          />

          {resolvedActivos.length > 0 && (
            <DataPagination
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              totalCount={filteredActivos.length}
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

      <InventarioEditModal
        isEditOpen={isEditOpen}
        setIsEditOpen={setIsEditOpen}
        editActivo={editActivo}
        setEditActivo={setEditActivo}
        editForm={editForm}
        handleEditChange={handleEditChange}
        handleEditSelectChange={handleEditSelectChange}
        isSaving={isSaving}
        handleEditSave={handleEditSave}
        ambientes={ambientes}
        rubroFromTipo={rubroFromTipo}
      />

      <InventarioImagesModal
        isImageModalOpen={isImageModalOpen}
        setIsImageModalOpen={setIsImageModalOpen}
        selectedActivoImages={selectedActivoImages}
        isLoadingImages={isLoadingImages}
        imageFiles={imageFiles}
        setImageFiles={setImageFiles}
      />
    </div>
  );
};

export default InventarioList;
