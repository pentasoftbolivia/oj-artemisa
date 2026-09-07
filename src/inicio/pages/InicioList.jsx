import { useEffect, useMemo, useState } from "react";

import LoadingSpinner from "@/components/ui/loading-spinner";
import { Loader2, Package, X, FileSpreadsheet } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TablaActivos, SeccionActivos, PaginacionTabla } from "../components/InmuebleActivosTable";
import * as XLSX from "xlsx";

import InventarioSummary from "../components/InventarioSummary";
import InventarioHeader from "../components/InventarioHeader";
import InventarioInmuebleModal from "../components/InventarioInmuebleModal";
import InventarioFechaModal from "../components/InventarioFechaModal";
import { exportPanelesToExcel } from "../services/inventarioExport";

import { useInventarioData } from "../hooks/useInventarioData";
import { useUbicacionOptions } from "@/hooks/useUbicacionOptions";
import { useUserDisplayNames } from "@/hooks/useUserDisplayNames";
import {
  normalizeCi,
  normalizeCiLoose,
  getCiPrefix,
} from "../constants/inventarioConstants";

const InicioList = () => {
  const { getDisplayName } = useUserDisplayNames();

  const {
    isLoading,
    ambientes,
    ciudades,
    inmuebles,
    niveles,
    rubroFromTipo,
    tipoRubroDescMap,
    ambienteMap,
    responsableMap,
    inventariadorStats,
    totalStats: rawTotalStats,
    universoTotal,
    loadInmuebleSummary,
    loadInmueblePendientes,
    loadInmuebleInventariados,
    loadInmuebleEnProceso,
    loadCiudadInmueblesStats,
    loadActivosPorFecha,
    loadActivosPorInventariador,
    loadActivos,
    loadInitialData,
  } = useInventarioData();

  const {
    ciudadOptions,
    inmuebleOptions,
    inmuebleCiudadMap,
  } = useUbicacionOptions({
    ciudades,
    inmuebles,
    niveles,
    ambientes,
  });

  const [isInmuebleModalOpen, setIsInmuebleModalOpen] = useState(false);
  const [isFechaModalOpen, setIsFechaModalOpen] = useState(false);
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);

  const PAGE_SIZE = 3;
  const [isUsuarioModalOpen, setIsUsuarioModalOpen] = useState(false);
  const [usuarioModalTitle, setUsuarioModalTitle] = useState("");
  const [usuarioModalList, setUsuarioModalList] = useState([]);
  const [usuarioModalPage, setUsuarioModalPage] = useState(1);
  const [isLoadingUsuarioModal, setIsLoadingUsuarioModal] = useState(false);
  const [isGeneratingUsuarioExcel, setIsGeneratingUsuarioExcel] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    loadActivos();
  }, [loadActivos]);

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
      ambienteMap[c] ??
      (c || "—")
    );
  };

  const getResponsableName = (cirun) => {
    const rawCi = String(cirun ?? "").trim();
    if (!rawCi) return "—";
    const normCi = normalizeCi(rawCi);
    const looseCi = normalizeCiLoose(rawCi);
    const prefixCi = getCiPrefix(rawCi);
    const resp =
      responsableMap[normCi] ||
      responsableMap[looseCi] ||
      responsableMap[prefixCi] ||
      responsableMap[rawCi];
    return resp
      ? [resp.nombre1, resp.nombre2, resp.paterno, resp.materno]
          .map((s) => (s || "").trim())
          .filter(Boolean)
          .join(" ") || resp.cirun
      : rawCi || "—";
  };

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

  const usuarioTotalPages = useMemo(() => Math.max(1, Math.ceil(usuarioModalList.length / PAGE_SIZE)), [usuarioModalList]);
  const usuarioPageData = useMemo(() => {
    const start = (usuarioModalPage - 1) * PAGE_SIZE;
    return usuarioModalList.slice(start, start + PAGE_SIZE);
  }, [usuarioModalList, usuarioModalPage]);

  const mapActivoRow = (a) => {
    const trId = a.tiporubroact ?? a.tipoRubroAct ?? "";
    const codBase = (a.codigoactivo ?? a.codigoActivo ?? "").toString().trim();
    return [
      codBase ? `OJ-02-${codBase}` : "—",
      (rubroFromTipo[trId] ?? rubroFromTipo[String(trId)] ?? "").toString().trim(),
      (tipoRubroDescMap[trId] ?? tipoRubroDescMap[String(trId)] ?? "").toString().trim(),
      a.descripcionactivo ?? a.descripcionActivo ?? "—",
      getAmbienteName(String(a.codigoambiente ?? a.codigoAmbiente ?? "").trim()),
      getResponsableName(a.cirun),
      a.cirun || "—",
    ];
  };

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

  const handleShowPendientes = async (email) => {
    const display = getDisplayName(email);
    setUsuarioModalTitle(`NO REVISADOS — ${display}`);
    setUsuarioModalList([]);
    setUsuarioModalPage(1);
    setIsUsuarioModalOpen(true);
    setIsLoadingUsuarioModal(true);
    try {
      const data = await loadActivosPorInventariador({ usuario: email, estado: "pendiente" });
      setUsuarioModalList(data || []);
    } catch (e) {
      console.error("Error loading no revisados por inventariador:", e);
      setUsuarioModalList([]);
    } finally {
      setIsLoadingUsuarioModal(false);
    }
  };

  const handleShowRevisados = async (email) => {
    const display = getDisplayName(email);
    setUsuarioModalTitle(`REVISADOS — ${display}`);
    setUsuarioModalList([]);
    setUsuarioModalPage(1);
    setIsUsuarioModalOpen(true);
    setIsLoadingUsuarioModal(true);
    try {
      const data = await loadActivosPorInventariador({ usuario: email, estado: "revisado" });
      setUsuarioModalList(data || []);
    } catch (e) {
      console.error("Error loading revisados por inventariador:", e);
      setUsuarioModalList([]);
    } finally {
      setIsLoadingUsuarioModal(false);
    }
  };

  const handleCloseUsuarioModal = () => {
    setIsUsuarioModalOpen(false);
    setUsuarioModalList([]);
    setUsuarioModalPage(1);
    setUsuarioModalTitle("");
  };

  const handleExportUsuarioExcel = () => {
    if (!usuarioModalList.length) return;
    setIsGeneratingUsuarioExcel(true);
    try {
      const isRevisados = usuarioModalTitle.startsWith("REVISADOS");
      const headers = ["Código", "Rubro", "Tipo Rubro", "Descripción", "Ambiente", "Responsable", "CI Responsable"];
      const dataRows = usuarioModalList.map(mapActivoRow);
      const inventariador = usuarioModalTitle.replace("REVISADOS — ", "").replace("NO REVISADOS — ", "").replace("Activos Revisados — ", "").replace("Activos No Revisados — ", "").trim() || "Inventariador";
      const titulo = isRevisados ? "ACTIVOS REVISADOS" : "ACTIVOS NO REVISADOS";
      const sheetData = [
        ["REPORTES DE ACTIVOS - ÓRGANO JUDICIAL"],
        [titulo],
        [`INVENTARIADOR: ${inventariador}`],
        [`Total activos: ${usuarioModalList.length}`],
        [],
        headers,
        ...dataRows,
      ];
      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws["!cols"] = [{ wch: 14 }, { wch: 22 }, { wch: 22 }, { wch: 40 }, { wch: 30 }, { wch: 25 }, { wch: 14 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, isRevisados ? "Revisados" : "NoRevisados");
      const safeName = inventariador.replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 30) || "Inventariador";
      const prefix = isRevisados ? "Activos_Revisados" : "Activos_NoRevisados";
      XLSX.writeFile(wb, `${prefix}_${safeName}.xlsx`);
    } catch (e) {
      console.error("Error generando Excel inventariador:", e);
    } finally {
      setIsGeneratingUsuarioExcel(false);
    }
  };

  if (isLoading && !totalStats.total && inventariadorStats.length === 0) {
    return <LoadingSpinner />;
  }

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
        universoTotal={universoTotal}
        onSelectPendientes={handleShowPendientes}
        onSelectRevisados={handleShowRevisados}
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

      <Dialog open={isUsuarioModalOpen} onOpenChange={(open) => !open && handleCloseUsuarioModal()}>
        <DialogContent className="w-full max-w-[96vw] sm:max-w-[1200px] max-h-[85vh] flex flex-col p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              {usuarioModalTitle || "Activos por Inventariador"}
            </DialogTitle>
            <DialogDescription>
              {usuarioModalList.length > 0
                ? `Mostrando ${usuarioModalList.length} activo(s) para el inventariador seleccionado.`
                : "Listado de activos filtrado por inventariador y estado."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 flex flex-col">
            {isLoadingUsuarioModal ? (
              <div className="flex flex-col justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="mt-4 text-muted-foreground animate-pulse">Cargando activos...</p>
              </div>
            ) : usuarioModalList.length > 0 ? (
              <SeccionActivos
                titulo={usuarioModalTitle.startsWith("REVISADOS") ? "ACTIVOS REVISADOS" : "ACTIVOS NO REVISADOS"}
                count={usuarioModalList.length}
                tituloClass={usuarioModalTitle.startsWith("REVISADOS") ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"}
                headerClass={usuarioModalTitle.startsWith("REVISADOS") ? "bg-green-50 dark:bg-green-950/20" : "bg-orange-50 dark:bg-orange-950/20"}
              >
                <TablaActivos items={usuarioPageData} mapRow={mapActivoRow} />
                <PaginacionTabla
                  count={usuarioModalList.length}
                  mostrados={usuarioPageData.length}
                  page={usuarioModalPage}
                  totalPages={usuarioTotalPages}
                  onPrev={() => setUsuarioModalPage((p) => Math.max(1, p - 1))}
                  onNext={() => setUsuarioModalPage((p) => Math.min(usuarioTotalPages, p + 1))}
                />
              </SeccionActivos>
            ) : (
              <div className="text-center text-muted-foreground py-8 border rounded-md">
                <Package className="mx-auto h-10 w-10 opacity-20 mb-2" />
                No se encontraron activos para el filtro seleccionado.
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-between gap-2 pt-4">
            <Button
              onClick={handleExportUsuarioExcel}
              disabled={!usuarioModalList.length || isGeneratingUsuarioExcel || isLoadingUsuarioModal}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isGeneratingUsuarioExcel ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
              Reporte en Excel
            </Button>
            <Button variant="outline" onClick={handleCloseUsuarioModal}>
              <X className="h-4 w-4 mr-2" />
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InicioList;

