import { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Package, Building2, CalendarDays, FileSpreadsheet, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { selectUser } from "@/store/auth/authSlice";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/ui/loading-spinner";

import InventarioFilters from "../components/InventarioFilters";
import InventarioTable from "../components/InventarioTable";
import InventarioBusqueda from "../components/InventarioBusqueda";
import InventarioSummary from "../components/InventarioSummary";
import InventarioInmuebleModal from "../components/InventarioInmuebleModal";
import InventarioFechaModal from "../components/InventarioFechaModal";
import DataPagination from "@/components/ui/data-pagination";

import { useInventarioData } from "../hooks/useInventarioData";
import { useInventarioState } from "../hooks/useInventarioState";
import { useUbicacionOptions } from "@/hooks/useUbicacionOptions";
import { useUserDisplayNames } from "@/hooks/useUserDisplayNames";
import {
  getRubroFields,
  normalizeCi,
  normalizeCiLoose,
  getCiPrefix,
} from "../constants/inventarioConstants";
import {
  InventarioEditModal,
  InventarioImagesModal,
} from "../components/InventarioModals";

const TOTAL_ACTIVOS = 43310;

const InventarioList = () => {
  const { toast } = useToast();
  const currentUser = useSelector(selectUser);
  const { getDisplayName } = useUserDisplayNames();

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
    ciudades,
    inmuebles,
    niveles,
    totalStats: rawTotalStats,
    loadInmuebleSummary,
    loadInmueblePendientes,
    loadActivosPorFecha,
    page,
    pageSize,
    setPage,
    setPageSize,
    applyEstado,
    adjustStatsLocal,
    totalCount,
    totalPages,
    loadActivos,
    loadInitialData,
  } = useInventarioData();

  const {
    filtros: {
      filtroCodigoActivo, setFiltroCodigoActivo,
      filtroInventariador, setFiltroInventariador,
      filtroCarnet, setFiltroCarnet,
      filtroEstado, setFiltroEstado,
      filtroCiudad, setFiltroCiudad,
      filtroInmueble, setFiltroInmueble,
      filtroNivel, setFiltroNivel,
      filtroAmbiente, setFiltroAmbiente,
      getUbicacionFilters,
      handleFilter,
      clearFilters,
    },
    busqueda: {
      showSearch, setShowSearch,
      searchCarnet, setSearchCarnet,
      searchNombre, setSearchNombre,
      handleSearch,
      clearSearch,
    },
    modales: {
      editActivo, setEditActivo,
      isEditOpen, setIsEditOpen,
      editForm, setEditForm,
      isSaving, setIsSaving,
      isImageModalOpen, setIsImageModalOpen,
      selectedActivoImages, setSelectedActivoImages,
      imageFiles, setImageFiles,
      isLoadingImages, setIsLoadingImages,
    }
  } = useInventarioState(loadActivos);

  const {
    ciudadOptions,
    inmuebleOptions,
    inmuebleCiudadMap,
    inmuebleOptionsByCiudad,
    nivelOptionsByInmueble,
    ambienteOptionsByNivel,
  } = useUbicacionOptions({
    ciudades,
    inmuebles,
    niveles,
    ambientes,
    filters: {
      ciudad: filtroCiudad,
      inmueble: filtroInmueble,
      nivel: filtroNivel,
    },
  });

  const [isInmuebleModalOpen, setIsInmuebleModalOpen] = useState(false);
  const [isFechaModalOpen, setIsFechaModalOpen] = useState(false);
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);

  const firstEstadoRef = useRef(true);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (rubros.length > 0 && tipoRubros.length > 0) {
      loadActivos({});
    }
  }, [rubros, tipoRubros, loadActivos]);

  useEffect(() => {
    if (firstEstadoRef.current) {
      firstEstadoRef.current = false;
      return;
    }
    applyEstado(filtroEstado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroEstado]);

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
      observaciones: (activo.observaciones || "").trim(),
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
      fieldsToUpdate.observaciones = editForm.observaciones || null;
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
        estado: filtroEstado,
        ...getUbicacionFilters(),
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
        cirun: normalizeCi(editActivo.cirun),
        descripcionactivo: editForm.descripcionActivo,
        tiporubroact: editActivo.tipoRubroAct,
        serie: editActivo.serie,
        marcamaterial: editActivo.marcaMaterial,
        estado: editActivo.estado,
        observaciones: editForm.observaciones || editActivo.observaciones,
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
      loadActivos({
        carnet: searchCarnet,
        nombre: searchNombre,
        all: true,
        ...getUbicacionFilters(),
      });
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
      adjustStatsLocal(activo, updateData.estadoinventario);
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
      adjustStatsLocal(activo, "ENVIADO");
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

  const ubicacionJerarquiaMap = useMemo(() => {
    const nivelMap = {};
    (niveles || []).forEach((n) => {
      nivelMap[String(n.codigonivel ?? "").trim()] = n;
    });
    const inmuebleMap = {};
    (inmuebles || []).forEach((i) => {
      inmuebleMap[String(i.codigoinmueble ?? "").trim()] = i;
    });
    const ciudadMap = {};
    (ciudades || []).forEach((c) => {
      ciudadMap[String(c.codigociudad ?? "").trim()] = c;
    });
    const ambMap = {};
    (ambientes || []).forEach((a) => {
      const code = String(a.codigoambiente ?? "").trim();
      if (!code) return;
      const nivel = nivelMap[String(a.codigonivel ?? "").trim()];
      const inmueble = nivel
        ? inmuebleMap[String(nivel.codigoinmueble ?? "").trim()]
        : null;
      const ciudad = inmueble
        ? ciudadMap[String(inmueble.codigociudad ?? "").trim()]
        : null;
      ambMap[code] =
        [ciudad?.descripcion, inmueble?.inmueble, nivel?.nivel, a.ambiente]
          .map((s) => (s || "").trim())
          .filter(Boolean)
          .join(" / ") || "—";
    });
    return ambMap;
  }, [ambientes, niveles, inmuebles, ciudades]);

  const getAmbienteName = (code) => {
    const c = String(code ?? "").trim();
    return (
      ubicacionJerarquiaMap[c] ??
      ambMap[c] ??
      ambCatMap[c] ??
      (c || "—")
    );
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

  const paginatedData = resolvedActivos;
  const safeCurrentPage = useMemo(
    () => Math.min(page, totalPages),
    [page, totalPages],
  );

  const totalStats = useMemo(
    () => ({
      ...rawTotalStats,
      progreso: (rawTotalStats.total / TOTAL_ACTIVOS) * 100,
    }),
    [rawTotalStats],
  );

  const progressLevel = useMemo(() => {
    if (totalStats.progreso >= 80) return "high";
    if (totalStats.progreso >= 50) return "mid";
    return "low";
  }, [totalStats.progreso]);

  const progressTextColors = {
    low: "#dc2626",
    mid: "#ca8a04",
    high: "#16a34a",
  };

  const ubicacionLabel = useMemo(() => {
    const ciudad =
      ciudadOptions.find(
        (o) => String(o.value).trim() === String(filtroCiudad).trim(),
      )?.label || "";
    const inmueble =
      inmuebleOptionsByCiudad.find(
        (o) => String(o.value).trim() === String(filtroInmueble).trim(),
      )?.label || "";
    return [ciudad, inmueble].filter(Boolean).join(" - ");
  }, [ciudadOptions, inmuebleOptionsByCiudad, filtroCiudad, filtroInmueble]);

  if (isLoading && activos.length === 0 && rubros.length === 0) {
    return <LoadingSpinner />;
  }

  if (showSearch) {
    return (
      <InventarioBusqueda
        onBack={() => setShowSearch(false)}
        searchCarnet={searchCarnet}
        setSearchCarnet={setSearchCarnet}
        searchNombre={searchNombre}
        setSearchNombre={setSearchNombre}
        onSearch={handleSearch}
        onClearSearch={clearSearch}
        isLoading={isLoading}
        filtroCiudad={filtroCiudad}
        setFiltroCiudad={setFiltroCiudad}
        filtroInmueble={filtroInmueble}
        setFiltroInmueble={setFiltroInmueble}
        filtroNivel={filtroNivel}
        setFiltroNivel={setFiltroNivel}
        filtroAmbiente={filtroAmbiente}
        setFiltroAmbiente={setFiltroAmbiente}
        ciudadOptions={ciudadOptions}
        inmuebleOptionsByCiudad={inmuebleOptionsByCiudad}
        nivelOptionsByInmueble={nivelOptionsByInmueble}
        ambienteOptionsByNivel={ambienteOptionsByNivel}
        rows={resolvedActivos}
        safeCurrentPage={safeCurrentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        currentUser={currentUser}
        getAmbienteName={getAmbienteName}
        getResponsableName={getResponsableName}
        onEdit={handleEdit}
        onEnviar={handleEnviar}
        isEditOpen={isEditOpen}
        setIsEditOpen={setIsEditOpen}
        editActivo={editActivo}
        setEditActivo={setEditActivo}
        editForm={editForm}
        onEditChange={handleEditChange}
        onEditSelectChange={handleEditSelectChange}
        isSaving={isSaving}
        onRegistrar={handleRegistrar}
        ambientes={ambientes}
        rubroFromTipo={rubroFromTipo}
      />
    );
  }

  const handleGenerarExcelPaneles = () => {
    setIsGeneratingExcel(true);
    try {
      const wb = XLSX.utils.book_new();
      const rows = [
        ["RESUMEN DE TOTALES"],
        ["TOTAL ACTIVOS INVENTARIADOS", totalStats.total],
        ["NO REVISADOS", totalStats.noRevisados],
        ["REVISADOS", totalStats.revisados],
        ["PROGRESO", `${totalStats.progreso.toFixed(2)}%`],
        [],
        ["RESUMEN POR INVENTARIADOR"],
        ["INVENTARIADOR", "PENDIENTES", "REVISADOS"],
        ...inventariadorStats.map((stat) => [
          getDisplayName(stat.email),
          stat.pendiente,
          stat.revisado,
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [{ wch: 30 }, { wch: 14 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws, "Panel de Control");
      XLSX.writeFile(wb, "Panel_Control_Inventario.xlsx");
    } catch (e) {
      console.error("Error generando Excel de paneles:", e);
    } finally {
      setIsGeneratingExcel(false);
    }
  };

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
          <Button
            variant="outline"
            size="sm"
            className="mt-3 bg-sky-300 hover:bg-sky-400 text-sky-950 border-sky-400"
            onClick={handleGenerarExcelPaneles}
            disabled={isGeneratingExcel}
          >
            {isGeneratingExcel ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 mr-2" />
            )}
            Reporte de Paneles
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setIsInmuebleModalOpen(true)}>
            <Building2 className="mr-2 h-4 w-4" />
            POR INMUEBLE
          </Button>
          <Button variant="outline" onClick={() => setIsFechaModalOpen(true)}>
            <CalendarDays className="mr-2 h-4 w-4" />
            POR FECHA
          </Button>
        </div>
      </div>

      <InventarioSummary
        totalStats={totalStats}
        progressLevel={progressLevel}
        progressTextColors={progressTextColors}
        inventariadorStats={inventariadorStats}
        getDisplayName={getDisplayName}
        ubicacionLabel={ubicacionLabel}
      />

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
        filtroCiudad={filtroCiudad}
        setFiltroCiudad={setFiltroCiudad}
        filtroInmueble={filtroInmueble}
        setFiltroInmueble={setFiltroInmueble}
        filtroNivel={filtroNivel}
        setFiltroNivel={setFiltroNivel}
        filtroAmbiente={filtroAmbiente}
        setFiltroAmbiente={setFiltroAmbiente}
        ciudadOptions={ciudadOptions}
        inmuebleOptionsByCiudad={inmuebleOptionsByCiudad}
        nivelOptionsByInmueble={nivelOptionsByInmueble}
        ambienteOptionsByNivel={ambienteOptionsByNivel}
        isLoading={isLoading}
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
            getInventariadorName={getDisplayName}
            onEdit={handleEdit}
            onOpenImages={handleOpenImages}
            onToggleAprobado={handleToggleAprobado}
            currentUser={currentUser}
          />

          {resolvedActivos.length > 0 && (
            <DataPagination
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
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

      <InventarioInmuebleModal
        isOpen={isInmuebleModalOpen}
        onClose={() => setIsInmuebleModalOpen(false)}
        ciudadOptions={ciudadOptions}
        inmuebleOptions={inmuebleOptions}
        inmuebleCiudadMap={inmuebleCiudadMap}
        getDisplayName={getDisplayName}
        loadInmuebleSummary={loadInmuebleSummary}
        loadInmueblePendientes={loadInmueblePendientes}
        getAmbienteName={getAmbienteName}
        getResponsableName={getResponsableName}
        rubroFromTipo={rubroFromTipo}
        tipoRubroDescMap={tipoRubroDescMap}
      />

      <InventarioFechaModal
        isOpen={isFechaModalOpen}
        onClose={() => setIsFechaModalOpen(false)}
        getDisplayName={getDisplayName}
        loadActivosPorFecha={loadActivosPorFecha}
      />
    </div>
  );
};

export default InventarioList;
