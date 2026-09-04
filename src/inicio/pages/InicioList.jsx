import { useEffect, useMemo, useState } from "react";

import LoadingSpinner from "@/components/ui/loading-spinner";

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

  if (isLoading && !totalStats.total && inventariadorStats.length === 0) {
    return <LoadingSpinner />;
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
        universoTotal={universoTotal}
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

export default InicioList;

