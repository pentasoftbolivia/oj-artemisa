import { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Package } from "lucide-react";
import { selectUser } from "@/store/auth/authSlice";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import LoadingSpinner from "@/components/ui/loading-spinner";

import InventarioFilters from "../components/InventarioFilters";
import InventarioTable from "../components/InventarioTable";
import InventarioBusqueda from "../components/InventarioBusqueda";
import InventarioSummary from "../components/InventarioSummary";
import InventarioHeader from "../components/InventarioHeader";
import InventarioInmuebleModal from "../components/InventarioInmuebleModal";
import InventarioFechaModal from "../components/InventarioFechaModal";
import DataPagination from "@/components/ui/data-pagination";
import { exportPanelesToExcel } from "../services/inventarioExport";

import { useInventarioData } from "../hooks/useInventarioData";
import { useInventarioState } from "../hooks/useInventarioState";
import { useInventarioActions } from "../hooks/useInventarioActions";
import { useUbicacionOptions } from "@/hooks/useUbicacionOptions";
import { useUserDisplayNames } from "@/hooks/useUserDisplayNames";
import {
  normalizeCi,
  normalizeCiLoose,
  getCiPrefix,
} from "../constants/inventarioConstants";
import {
  InventarioEditModal,
  InventarioImagesModal,
} from "../components/InventarioModals";

const InventarioList = () => {
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
    universoTotal,
    loadInmuebleSummary,
    loadInmueblePendientes,
    loadInmuebleInventariados,
    loadInmuebleEnProceso,
    loadCiudadInmueblesStats,
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

  const {
    handleEdit,
    handleEditChange,
    handleEditSelectChange,
    handleEditSave,
    handleRegistrar,
    handleToggleAprobado,
    handleEnviar,
    handleOpenImages,
  } = useInventarioActions({
    currentUser,
    rubroFromTipo,
    tipoRubroDescMap,
    loadActivos,
    getUbicacionFilters,
    filtroCodigoActivo,
    filtroInventariador,
    filtroCarnet,
    filtroEstado,
    searchCarnet,
    searchNombre,
    showSearch,
    setActivos,
    adjustStatsLocal,
    setEditActivo,
    setIsEditOpen,
    setEditForm,
    setIsSaving,
    editActivo,
    editForm,
    setSelectedActivoImages,
    setIsLoadingImages,
    setIsImageModalOpen,
    setImageFiles,
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

  const ambMap =
    Object.keys(directAmbMap).length > 0 ? directAmbMap : directAmbRef.current;
  const ambCatMap =
    Object.keys(ambienteMap).length > 0
      ? ambienteMap
      : (() => {
          const m = {};
          (ambientesRef.current || []).forEach((a) => {
            const code = String(a.codigoambiente ?? "").trim();
            if (code) m[code] = a.ambiente;
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
      progreso: universoTotal > 0 ? (rawTotalStats.total / universoTotal) * 100 : 0,
    }),
    [rawTotalStats, universoTotal],
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
      exportPanelesToExcel({ totalStats, inventariadorStats, getDisplayName });
    } catch (e) {
      console.error("Error generando Excel de paneles:", e);
    } finally {
      setIsGeneratingExcel(false);
    }
  };

  return (
    <div className="space-y-6">
      <InventarioHeader
        onOpenInmueble={() => setIsInmuebleModalOpen(true)}
        onOpenFecha={() => setIsFechaModalOpen(true)}
        onExportPaneles={handleGenerarExcelPaneles}
        isGeneratingExcel={isGeneratingExcel}
      />

      <InventarioSummary
        totalStats={totalStats}
        progressLevel={progressLevel}
        progressTextColors={progressTextColors}
        inventariadorStats={inventariadorStats}
        getDisplayName={getDisplayName}
        ubicacionLabel={ubicacionLabel}
        universoTotal={universoTotal}
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
        loadInmuebleInventariados={loadInmuebleInventariados}
        loadInmuebleEnProceso={loadInmuebleEnProceso}
        loadCiudadInmueblesStats={loadCiudadInmueblesStats}
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
