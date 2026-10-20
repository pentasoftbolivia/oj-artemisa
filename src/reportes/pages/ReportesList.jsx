import { useState } from "react";
import { FileDown, Loader2, BarChart3, RefreshCw } from "lucide-react";
import { useSelector } from "react-redux";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { selectUser } from "@/store/auth/authSlice";
import { useReporteInventarioGeneral } from "@/inicio/hooks/useReporteInventarioGeneral";
import { useReporteInventarioGeneralExcel } from "@/inicio/hooks/useReporteInventarioGeneralExcel";
import { useReportePorUbicacion } from "@/inicio/hooks/useReportePorUbicacion";
import { useReportePorUbicacionExcel } from "@/inicio/hooks/useReportePorUbicacionExcel";
import { useReportePorRubro } from "@/inicio/hooks/useReportePorRubro";
import { useReportePorRubroExcel } from "@/inicio/hooks/useReportePorRubroExcel";
import { useReporteFaltantes } from "@/inicio/hooks/useReporteFaltantes";
import { useReporteFaltantesExcel } from "@/inicio/hooks/useReporteFaltantesExcel";
import { useReporteCostoActualizado } from "@/inicio/hooks/useReporteCostoActualizado";
import { useReporteCostoActualizadoExcel } from "@/inicio/hooks/useReporteCostoActualizadoExcel";
import { useReporteParaRevaluo } from "@/inicio/hooks/useReporteParaRevaluo";
import { useReporteParaRevaluoExcel } from "@/inicio/hooks/useReporteParaRevaluoExcel";
import { useReporteReclasificarRubro } from "@/inicio/hooks/useReporteReclasificarRubro";
import { useReporteReclasificarRubroExcel } from "@/inicio/hooks/useReporteReclasificarRubroExcel";
import { useReporteGrupoContable } from "@/inicio/hooks/useReporteGrupoContable";
import { useReporteGrupoContableExcel } from "@/inicio/hooks/useReporteGrupoContableExcel";
import { useReporteActivosBaja } from "@/inicio/hooks/useReporteActivosBaja";
import { useReporteActivosBajaExcel } from "@/inicio/hooks/useReporteActivosBajaExcel";
import { useReporteFungible } from "@/inicio/hooks/useReporteFungible";
import { useReporteFungibleExcel } from "@/inicio/hooks/useReporteFungibleExcel";
import { useReporteBajasEncontradas } from "@/inicio/hooks/useReporteBajasEncontradas";
import { useReporteBajasEncontradasExcel } from "@/inicio/hooks/useReporteBajasEncontradasExcel";
import { useReporteEncontradosBaja } from "@/inicio/hooks/useReporteEncontradosBaja";
import { useReporteEncontradosBajaExcel } from "@/inicio/hooks/useReporteEncontradosBajaExcel";
import { useReporteDepreciacion } from "@/inicio/hooks/useReporteDepreciacion";
import { useReporteDepreciacionExcel } from "@/inicio/hooks/useReporteDepreciacionExcel";
import { useReporteDepreciacionPorRubro } from "@/inicio/hooks/useReporteDepreciacionPorRubro";
import { useReporteDepreciacionPorRubroExcel } from "@/inicio/hooks/useReporteDepreciacionPorRubroExcel";
import { useReporteActivosObsoletos } from "@/inicio/hooks/useReporteActivosObsoletos";
import { useReporteActivosObsoletosExcel } from "@/inicio/hooks/useReporteActivosObsoletosExcel";
import { useReporteBienesFaltantes } from "@/inicio/hooks/useReporteBienesFaltantes";
import { useReporteBienesFaltantesExcel } from "@/inicio/hooks/useReporteBienesFaltantesExcel";
import { useReporteBienesSobrantes } from "@/inicio/hooks/useReporteBienesSobrantes";
import { useReporteBienesSobrantesExcel } from "@/inicio/hooks/useReporteBienesSobrantesExcel";
import EvaluacionTecnicaBloquesModal from "../components/EvaluacionTecnicaBloquesModal";
import ObsoletosGrupoModal from "../components/ObsoletosGrupoModal";
import EncontradosBajaModal from "../components/EncontradosBajaModal";
import FaltantesActivoModal from "../components/FaltantesActivoModal";
import ReporteFormatoModal from "../components/ReporteFormatoModal";
import { useRubrosExcluidosLista } from "@/inicio/hooks/useRubrosExcluidosLista";
import { useReporteObsoletosP4 } from "@/inicio/hooks/useReporteObsoletosP4";
import { useReporteObsoletosP4Excel } from "@/inicio/hooks/useReporteObsoletosP4Excel";
import { useReporteActivo37713 } from "@/inicio/hooks/useReporteActivo37713";
import { useReporteActivo37713Excel } from "@/inicio/hooks/useReporteActivo37713Excel";
import { useReporteEncontradosPorRubro } from "@/inicio/hooks/useReporteEncontradosPorRubro";
import { useReporteEncontradosPorRubroExcel } from "@/inicio/hooks/useReporteEncontradosPorRubroExcel";
import { useReporteFaltantesPorRubro } from "@/inicio/hooks/useReporteFaltantesPorRubro";
import { useReporteFaltantesPorRubroExcel } from "@/inicio/hooks/useReporteFaltantesPorRubroExcel";

const ALLOWED_RESTRICTED_REPORT_EMAIL = "javiercostasaliaga@gmail.com";

const ReportesList = () => {
  const user = useSelector(selectUser);
  const currentEmail = String(user?.email ?? "").trim().toLowerCase();
  const canSeeReports = currentEmail === ALLOWED_RESTRICTED_REPORT_EMAIL;

  const { generate: generateInventarioGeneral, isGenerating: isGeneratingGeneral } = useReporteInventarioGeneral();
  const { generate: generateInventarioGeneralExcel, isGenerating: isGeneratingGeneralExcel } = useReporteInventarioGeneralExcel();
  const { generate: generatePorUbicacion, isGenerating: isGeneratingUbicacion } = useReportePorUbicacion();
  const { generate: generatePorUbicacionExcel, isGenerating: isGeneratingUbicacionExcel } = useReportePorUbicacionExcel();
  const { generate: generatePorRubro, isGenerating: isGeneratingRubro } = useReportePorRubro();
  const { generate: generatePorRubroExcel, isGenerating: isGeneratingRubroExcel } = useReportePorRubroExcel();
  const { generate: generateFaltantes, isGenerating: isGeneratingFaltantes } = useReporteFaltantes();
  const { generate: generateFaltantesExcel, isGenerating: isGeneratingFaltantesExcel } = useReporteFaltantesExcel();
  const { generate: generateCosto, isGenerating: isGeneratingCosto } = useReporteCostoActualizado();
  const { generate: generateCostoExcel, isGenerating: isGeneratingCostoExcel } = useReporteCostoActualizadoExcel();
  const { generate: generateParaRevaluo, isGenerating: isGeneratingParaRevaluo } = useReporteParaRevaluo();
  const { generate: generateParaRevaluoExcel, isGenerating: isGeneratingParaRevaluoExcel } = useReporteParaRevaluoExcel();
  const { generate: generateReclasificar, isGenerating: isGeneratingReclasificar } = useReporteReclasificarRubro();
  const { generate: generateReclasificarExcel, isGenerating: isGeneratingReclasificarExcel } = useReporteReclasificarRubroExcel();
  const { generate: generateGrupoContable, isGenerating: isGeneratingGrupoContable } = useReporteGrupoContable();
  const { generate: generateGrupoContableExcel, isGenerating: isGeneratingGrupoContableExcel } = useReporteGrupoContableExcel();
  const { generate: generateBaja, isGenerating: isGeneratingBaja } = useReporteActivosBaja();
  const { generate: generateBajaExcel, isGenerating: isGeneratingBajaExcel } = useReporteActivosBajaExcel();
  const { generate: generateFungible, isGenerating: isGeneratingFungible } = useReporteFungible();
  const { generate: generateFungibleExcel, isGenerating: isGeneratingFungibleExcel } = useReporteFungibleExcel();
  const { generate: generateBajasEncontradas, isGenerating: isGeneratingBajasEncontradas } = useReporteBajasEncontradas();
  const { generate: generateBajasEncontradasExcel, isGenerating: isGeneratingBajasEncontradasExcel } = useReporteBajasEncontradasExcel();
  const { generate: generateEncontradosBajaActivos, isGenerating: isGeneratingEncontradosBajaActivos } = useReporteEncontradosBaja();
  const { generate: generateEncontradosBajaActivosExcel, isGenerating: isGeneratingEncontradosBajaActivosExcel } = useReporteEncontradosBajaExcel();
  const { generate: generateDepreciacion, isGenerating: isGeneratingDepreciacion } = useReporteDepreciacion();
  const { generate: generateDepreciacionRecalculada, isGenerating: isGeneratingDepreciacionRecalculada } = useReporteDepreciacion();
  const { generate: generateDepreciacionExcel, isGenerating: isGeneratingDepreciacionExcel } = useReporteDepreciacionExcel();
  const { generate: generateDepreciacionPorRubro, isGenerating: isGeneratingDepreciacionPorRubro } = useReporteDepreciacionPorRubro();
  const { generate: generateDepreciacionPorRubroExcel, isGenerating: isGeneratingDepreciacionPorRubroExcel } = useReporteDepreciacionPorRubroExcel();
  const { generate: generateObsoletos, isGenerating: isGeneratingObsoletos } = useReporteActivosObsoletos();
  const { generate: generateObsoletosExcel, isGenerating: isGeneratingObsoletosExcel } = useReporteActivosObsoletosExcel();
  const { generate: generateFaltantesP3, isGenerating: isGeneratingFaltantesP3 } = useReporteBienesFaltantes();
  const { generate: generateFaltantesP3Excel, isGenerating: isGeneratingFaltantesP3Excel } = useReporteBienesFaltantesExcel();
  const { generate: generateSobrantes, isGenerating: isGeneratingSobrantes } = useReporteBienesSobrantes();
  const { generate: generateSobrantesExcel, isGenerating: isGeneratingSobrantesExcel } = useReporteBienesSobrantesExcel();
  const { generate: generateObsoletosP4, isGenerating: isGeneratingObsoletosP4 } = useReporteObsoletosP4();
  const { generate: generateObsoletosP4Excel, isGenerating: isGeneratingObsoletosP4Excel } = useReporteObsoletosP4Excel();
  const { generate: generateActivo37713, isGenerating: isGeneratingActivo37713 } = useReporteActivo37713();
  const { generate: generateActivo37713Excel, isGenerating: isGeneratingActivo37713Excel } = useReporteActivo37713Excel();
  const { generate: generateEncontradosPorRubro, isGenerating: isGeneratingEncontradosPorRubro } = useReporteEncontradosPorRubro();
  const { generate: generateEncontradosPorRubroExcel, isGenerating: isGeneratingEncontradosPorRubroExcel } = useReporteEncontradosPorRubroExcel();
  const { generate: generateFaltantesPorRubro, isGenerating: isGeneratingFaltantesPorRubro } = useReporteFaltantesPorRubro();
  const { generate: generateFaltantesPorRubroExcel, isGenerating: isGeneratingFaltantesPorRubroExcel } = useReporteFaltantesPorRubroExcel();
  const [isEvaluacionModalOpen, setIsEvaluacionModalOpen] = useState(false);
  const [isObsoletosGrupoModalOpen, setIsObsoletosGrupoModalOpen] = useState(false);
  const [isEncontradosBajaModalOpen, setIsEncontradosBajaModalOpen] = useState(false);
  const [isFaltantesActivoModalOpen, setIsFaltantesActivoModalOpen] = useState(false);
  const [formatoModalKey, setFormatoModalKey] = useState(null);
  const { downloadPDF: downloadRubrosPDF, downloadExcel: downloadRubrosExcel, generatingFormat: formatoRubros } = useRubrosExcluidosLista();

  const busy = isGeneratingGeneral || isGeneratingGeneralExcel || isGeneratingUbicacion || isGeneratingUbicacionExcel || isGeneratingRubro || isGeneratingRubroExcel || isGeneratingFaltantes || isGeneratingFaltantesExcel || isGeneratingCosto || isGeneratingCostoExcel || isGeneratingParaRevaluo || isGeneratingParaRevaluoExcel || isGeneratingReclasificar || isGeneratingReclasificarExcel || isGeneratingGrupoContable || isGeneratingGrupoContableExcel || isGeneratingBaja || isGeneratingBajaExcel || isGeneratingFungible || isGeneratingFungibleExcel || isGeneratingBajasEncontradas || isGeneratingBajasEncontradasExcel || isGeneratingEncontradosBajaActivos || isGeneratingEncontradosBajaActivosExcel || isGeneratingDepreciacion || isGeneratingDepreciacionRecalculada || isGeneratingDepreciacionExcel || isGeneratingDepreciacionPorRubro || isGeneratingDepreciacionPorRubroExcel || isGeneratingObsoletos || isGeneratingObsoletosExcel || isGeneratingFaltantesP3 || isGeneratingFaltantesP3Excel || isGeneratingSobrantes || isGeneratingSobrantesExcel || isGeneratingObsoletosP4 || isGeneratingObsoletosP4Excel || isGeneratingActivo37713 || isGeneratingActivo37713Excel || isGeneratingEncontradosPorRubro || isGeneratingEncontradosPorRubroExcel || isGeneratingFaltantesPorRubro || isGeneratingFaltantesPorRubroExcel || formatoRubros !== null;

  // Un solo botón por reporte (menos EVALUACION TECNICA): abre modal con PDF/Excel.
  const FORMATOS = {
    inventario: {
      titulo: "Inventario General",
      descripcion: "Activos ultimoregistro=1 y estadoinventario no vacío, ordenados por código. Elija el formato.",
      onPDF: generateInventarioGeneral, onExcel: generateInventarioGeneralExcel,
      pdf: isGeneratingGeneral, excel: isGeneratingGeneralExcel,
    },
    ubicacion: {
      titulo: "Reporte por Ubicación",
      descripcion: "Activos ultimoregistro=1 y estadoinventario no vacío, ordenados por ubicación. Elija el formato.",
      onPDF: generatePorUbicacion, onExcel: generatePorUbicacionExcel,
      pdf: isGeneratingUbicacion, excel: isGeneratingUbicacionExcel,
    },
    rubro: {
      titulo: "Reporte por Rubro",
      descripcion: "Total de activos por rubro (misma lógica del Inventario General). Elija el formato.",
      onPDF: generatePorRubro, onExcel: generatePorRubroExcel,
      pdf: isGeneratingRubro, excel: isGeneratingRubroExcel,
    },
    faltantes: {
      titulo: "Reporte Faltantes",
      descripcion: "Activos ultimoregistro=1 y estadoinventario vacío/nulo, excluyendo ciudades excepción. Elija el formato.",
      onPDF: generateFaltantes, onExcel: generateFaltantesExcel,
      pdf: isGeneratingFaltantes, excel: isGeneratingFaltantesExcel,
    },
    pararevaluo: {
      titulo: "Activos para Revalúo",
      descripcion: "Activos pararevaluo=true: totales, con dato y faltantes. Elija el formato.",
      onPDF: generateParaRevaluo, onExcel: generateParaRevaluoExcel,
      pdf: isGeneratingParaRevaluo, excel: isGeneratingParaRevaluoExcel,
    },
    reclasificar: {
      titulo: "Reclasificar el Rubro",
      descripcion: "Activos vigentes a reclasificar: tipo no canónico -> destino por mayoría. Elija el formato.",
      onPDF: generateReclasificar, onExcel: generateReclasificarExcel,
      pdf: isGeneratingReclasificar, excel: isGeneratingReclasificarExcel,
    },
    costo: {
      titulo: "Costo Actualizado y Depreciación",
      descripcion: "Totales por rubro: Saldo Inicial, Costo Actualizado y Depreciación al 01/01/2026. Elija el formato.",
      onPDF: generateCosto, onExcel: generateCostoExcel,
      pdf: isGeneratingCosto, excel: isGeneratingCostoExcel,
    },
    grupo: {
      titulo: "Grupo Contable",
      descripcion: "Agrupado por rubro (artemisaaltabaja=1, sin Biblioteca/Terrenos/Edificaciones). Elija el formato.",
      onPDF: generateGrupoContable, onExcel: generateGrupoContableExcel,
      pdf: isGeneratingGrupoContable, excel: isGeneratingGrupoContableExcel,
    },
    baja: {
      titulo: "Activos de Baja",
      descripcion: "Activos estado=0: código, rubro, tipo, descripción, ubicación, responsable y carnet. Elija el formato.",
      onPDF: generateBaja, onExcel: generateBajaExcel,
      pdf: isGeneratingBaja, excel: isGeneratingBajaExcel,
    },
    fungible: {
      titulo: "Fungible",
      descripcion: "Activos esactivo=false: código, rubro, tipo, descripción, ubicación, responsable y carnet. Elija el formato.",
      onPDF: generateFungible, onExcel: generateFungibleExcel,
      pdf: isGeneratingFungible, excel: isGeneratingFungibleExcel,
    },
    bajasEncontradas: {
      titulo: "Bajas Encontradas",
      descripcion: "Activos estado=0, esactivo=true y con estadoinventario. Elija el formato.",
      onPDF: generateBajasEncontradas, onExcel: generateBajasEncontradasExcel,
      pdf: isGeneratingBajasEncontradas, excel: isGeneratingBajasEncontradasExcel,
    },
    depreciacion: {
      titulo: "Depreciación",
      descripcion: "Activos con código <= 43753, estadoinventario con dato, artemisaaltabaja 0/1 y ultimoregistro=1: detalle + costo actualizado y depreciación. Elija el formato.",
      onPDF: generateDepreciacion, onExcel: generateDepreciacionExcel,
      pdf: isGeneratingDepreciacion, excel: isGeneratingDepreciacionExcel,
    },
    depreciacionPorRubro: {
      titulo: "Depreciación por Rubro",
      descripcion: "Mismos activos que Depreciación, agrupados por rubro: totales de costo actualizado, depreciación y valor neto. Elija el formato.",
      onPDF: generateDepreciacionPorRubro, onExcel: generateDepreciacionPorRubroExcel,
      pdf: isGeneratingDepreciacionPorRubro, excel: isGeneratingDepreciacionPorRubroExcel,
    },
    maquinaria: {
      titulo: "Activos de Maquinaria y Equipos de Producción",
      descripcion: "Activos del rubro MAQUINARIA Y EQUIPOS DE PRODUCCION: código de activo y datos de depreciación. Elija el formato.",
      onPDF: () => generateDepreciacion({ soloMaquinaria: true }),
      onExcel: () => generateDepreciacionExcel({ soloMaquinaria: true }),
      pdf: isGeneratingDepreciacion, excel: isGeneratingDepreciacionExcel,
    },
    obsoletos: {
      titulo: "Activos Obsoletos",
      descripcion: "Activos estadoconservacion=MALO. Elija el formato.",
      onPDF: generateObsoletos, onExcel: generateObsoletosExcel,
      pdf: isGeneratingObsoletos, excel: isGeneratingObsoletosExcel,
    },
    faltantesP3: {
      titulo: "Bienes Faltantes",
      descripcion: "Activos ultimoregistro=1 sin estadoinventario. Elija el formato.",
      onPDF: generateFaltantesP3, onExcel: generateFaltantesP3Excel,
      pdf: isGeneratingFaltantesP3, excel: isGeneratingFaltantesP3Excel,
    },
    sobrantes: {
      titulo: "Bienes Sobrantes",
      descripcion: "Activos ultimoregistro=1 y activonuevo=TRUE. Elija el formato.",
      onPDF: generateSobrantes, onExcel: generateSobrantesExcel,
      pdf: isGeneratingSobrantes, excel: isGeneratingSobrantesExcel,
    },
    sobrantesPorRubro: {
      titulo: "Sobrantes por Rubro",
      descripcion: "Activos ultimoregistro=1 y activonuevo=TRUE, agrupados por rubro. Elija el formato.",
      onPDF: () => generateSobrantes({ porRubro: true }),
      onExcel: () => generateSobrantesExcel({ porRubro: true }),
      pdf: isGeneratingSobrantes, excel: isGeneratingSobrantesExcel,
    },
    obsoletosP4: {
      titulo: "Activos Obsoletos",
      descripcion: "Fichas por activo (estado=1, MALO, sin edificaciones/biblioteca/terrenos). Elija el formato.",
      onPDF: generateObsoletosP4, onExcel: generateObsoletosP4Excel,
      pdf: isGeneratingObsoletosP4, excel: isGeneratingObsoletosP4Excel,
    },
    activo37713: {
      titulo: "Activo 37713",
      descripcion: "Ficha del activo 37713 vigente. Elija el formato.",
      onPDF: generateActivo37713, onExcel: generateActivo37713Excel,
      pdf: isGeneratingActivo37713, excel: isGeneratingActivo37713Excel,
    },
    rubrosExcluidos: {
      titulo: "Edif. Biblioteca y Terrenos",
      descripcion: "Activos vigentes de edificaciones, biblioteca y terrenos, agrupados por rubro. Elija el formato.",
      onPDF: downloadRubrosPDF, onExcel: downloadRubrosExcel,
      pdf: formatoRubros === "pdf", excel: formatoRubros === "excel",
    },
    encontradosPorRubro: {
      titulo: "Encontrados por Rubro",
      descripcion: "Mismo criterio que Encontrados en Estado Baja (codigoactivo <=43753, estadoinventario no nulo ni vacío, artemisaaltabaja=0, ultimoregistro=1), agrupado por rubro. Elija el formato.",
      onPDF: generateEncontradosPorRubro, onExcel: generateEncontradosPorRubroExcel,
      pdf: isGeneratingEncontradosPorRubro, excel: isGeneratingEncontradosPorRubroExcel,
    },
    faltantesPorRubro: {
      titulo: "Faltantes por Rubro",
      descripcion: "Mismo criterio que Faltantes en Estado Activo (codigoactivo <=43753, estadoinventario NULL o vacío y artemisaaltabaja=1), agrupado por rubro. Elija el formato.",
      onPDF: generateFaltantesPorRubro, onExcel: generateFaltantesPorRubroExcel,
      pdf: isGeneratingFaltantesPorRubro, excel: isGeneratingFaltantesPorRubroExcel,
    },
    encontradosActivos: {
      titulo: "Encontrado Baja Si Son Activos",
      descripcion: "Activos codigoactivo <= 43753, estadoinventario con dato, artemisaaltabaja=0, ultimoregistro=1 y esactivo=true. Elija el formato.",
      onPDF: () => generateEncontradosBajaActivos({ enAlta: true }),
      onExcel: () => generateEncontradosBajaActivosExcel({ enAlta: true }),
      pdf: isGeneratingEncontradosBajaActivos, excel: isGeneratingEncontradosBajaActivosExcel,
    },
    encontradosActivosPorRubro: {
      titulo: "Encontrado Baja Si Son Activos por Rubro",
      descripcion: "Mismo criterio que Encontrado Baja Si Son Activos, agrupado por rubro. Elija el formato.",
      onPDF: () => generateEncontradosPorRubro({ enAlta: true }),
      onExcel: () => generateEncontradosPorRubroExcel({ enAlta: true }),
      pdf: isGeneratingEncontradosPorRubro, excel: isGeneratingEncontradosPorRubroExcel,
    },
    encontradosNoActivos: {
      titulo: "Encontrados Baja No Son Activos",
      descripcion: "Activos codigoactivo <= 43753, estadoinventario con dato, artemisaaltabaja=0, ultimoregistro=1 y esactivo=false. Elija el formato.",
      onPDF: () => generateEncontradosBajaActivos({ soloNoActivos: true }),
      onExcel: () => generateEncontradosBajaActivosExcel({ soloNoActivos: true }),
      pdf: isGeneratingEncontradosBajaActivos, excel: isGeneratingEncontradosBajaActivosExcel,
    },
    encontradosNoActivosPorRubro: {
      titulo: "Encontrados Baja No Son Activos por Rubro",
      descripcion: "Mismo criterio que Encontrados Baja No Son Activos, agrupado por rubro. Elija el formato.",
      onPDF: () => generateEncontradosPorRubro({ soloNoActivos: true }),
      onExcel: () => generateEncontradosPorRubroExcel({ soloNoActivos: true }),
      pdf: isGeneratingEncontradosPorRubro, excel: isGeneratingEncontradosPorRubroExcel,
    },
    estabanEnBaja: {
      titulo: "Activos que Estaban en Baja",
      descripcion: "Activos codigoactivo <= 43753, estadoinventario con dato, artemisaaltabaja=0, ultimoregistro=1, esactivo=true y estadoconservacion <> MALO. Elija el formato.",
      onPDF: () => generateEncontradosBajaActivos({ estabanEnBaja: true }),
      onExcel: () => generateEncontradosBajaActivosExcel({ estabanEnBaja: true }),
      pdf: isGeneratingEncontradosBajaActivos, excel: isGeneratingEncontradosBajaActivosExcel,
    },
    estabanEnBajaPorRubro: {
      titulo: "Activos que Estaban en Baja por Rubro",
      descripcion: "Mismo criterio que Activos que Estaban en Baja, agrupado por rubro. Elija el formato.",
      onPDF: () => generateEncontradosPorRubro({ estabanEnBaja: true }),
      onExcel: () => generateEncontradosPorRubroExcel({ estabanEnBaja: true }),
      pdf: isGeneratingEncontradosPorRubro, excel: isGeneratingEncontradosPorRubroExcel,
    },
    obsoleto: {
      titulo: "Obsoleto",
      descripcion: "Activos codigoactivo <= 43753, estadoinventario con dato, artemisaaltabaja=1 y estadoconservacion = MALO. Elija el formato.",
      onPDF: () => generateEncontradosBajaActivos({ obsoleto: true }),
      onExcel: () => generateEncontradosBajaActivosExcel({ obsoleto: true }),
      pdf: isGeneratingEncontradosBajaActivos, excel: isGeneratingEncontradosBajaActivosExcel,
    },
    obsoletoPorRubro: {
      titulo: "Obsoleto por Rubro",
      descripcion: "Mismo criterio que Obsoleto, agrupado por rubro. Elija el formato.",
      onPDF: () => generateEncontradosPorRubro({ obsoleto: true }),
      onExcel: () => generateEncontradosPorRubroExcel({ obsoleto: true }),
      pdf: isGeneratingEncontradosPorRubro, excel: isGeneratingEncontradosPorRubroExcel,
    },
    todoRevaluo: {
      titulo: "Todo Revaluo",
      descripcion: "Activos de los 3 grupos de revalúo (Estado Baja, No son MALO, Códigos nuevos). Incluye Valor Revalúo. Elija el formato.",
      onPDF: () => generateEncontradosBajaActivos({ todoRevaluo: true }),
      onExcel: () => generateEncontradosBajaActivosExcel({ todoRevaluo: true }),
      pdf: isGeneratingEncontradosBajaActivos, excel: isGeneratingEncontradosBajaActivosExcel,
    },
    todoRevaluoPorRubro: {
      titulo: "Todo Revaluo por Rubro",
      descripcion: "Mismo criterio que Todo Revaluo (los 3 grupos de revalúo), agrupado por rubro. Elija el formato.",
      onPDF: () => generateEncontradosPorRubro({ todoRevaluo: true }),
      onExcel: () => generateEncontradosPorRubroExcel({ todoRevaluo: true }),
      pdf: isGeneratingEncontradosPorRubro, excel: isGeneratingEncontradosPorRubroExcel,
    },
    revaluo2553: {
      titulo: "Revaluo 2553",
      descripcion: "Activos con pararevaluo=true y activonuevo=false. Elija el formato.",
      onPDF: () => generateEncontradosBajaActivos({ revaluo2553: true }),
      onExcel: () => generateEncontradosBajaActivosExcel({ revaluo2553: true }),
      pdf: isGeneratingEncontradosBajaActivos, excel: isGeneratingEncontradosBajaActivosExcel,
    },
    revaluo1355: {
      titulo: "Revaluo 1355",
      descripcion: "Activos con pararevaluo=true y activonuevo=false. Elija el formato.",
      onPDF: () => generateEncontradosBajaActivos({ revaluo1355: true }),
      onExcel: () => generateEncontradosBajaActivosExcel({ revaluo1355: true }),
      pdf: isGeneratingEncontradosBajaActivos, excel: isGeneratingEncontradosBajaActivosExcel,
    },
    revaluo1355PorRubro: {
      titulo: "Revaluo 1355 por Rubro",
      descripcion: "Mismo criterio que Revaluo 1355, agrupado por rubro. Elija el formato.",
      onPDF: () => generateEncontradosPorRubro({ revaluo1355: true }),
      onExcel: () => generateEncontradosPorRubroExcel({ revaluo1355: true }),
      pdf: isGeneratingEncontradosPorRubro, excel: isGeneratingEncontradosPorRubroExcel,
    },
    revaluo2553PorRubro: {
      titulo: "Revaluo 2553 por Rubro",
      descripcion: "Mismo criterio que Revaluo 2553, agrupado por rubro. Elija el formato.",
      onPDF: () => generateEncontradosPorRubro({ revaluo2553: true }),
      onExcel: () => generateEncontradosPorRubroExcel({ revaluo2553: true }),
      pdf: isGeneratingEncontradosPorRubro, excel: isGeneratingEncontradosPorRubroExcel,
    },
    encontradosFisicamente: {
      titulo: "Encontrados Fisicamente",
      descripcion: "Activos codigoactivo <= 43753, estadoinventario con dato y artemisaaltabaja=1. Elija el formato.",
      onPDF: () => generateEncontradosBajaActivos({ encontradosFisicamente: true }),
      onExcel: () => generateEncontradosBajaActivosExcel({ encontradosFisicamente: true }),
      pdf: isGeneratingEncontradosBajaActivos, excel: isGeneratingEncontradosBajaActivosExcel,
    },
    encontradosFisicamentePorRubro: {
      titulo: "Encontrados Fisicamente por Rubro",
      descripcion: "Mismo criterio que Encontrados Fisicamente, agrupado por rubro. Elija el formato.",
      onPDF: () => generateEncontradosPorRubro({ encontradosFisicamente: true }),
      onExcel: () => generateEncontradosPorRubroExcel({ encontradosFisicamente: true }),
      pdf: isGeneratingEncontradosPorRubro, excel: isGeneratingEncontradosPorRubroExcel,
    },
    encontradosEnBajaFisicamente: {
      titulo: "Encontrados en Baja Fisicamente",
      descripcion: "Activos codigoactivo <= 43753, estadoinventario con dato y artemisaaltabaja=0. Elija el formato.",
      onPDF: () => generateEncontradosBajaActivos({ encontradosEnBajaFisicamente: true }),
      onExcel: () => generateEncontradosBajaActivosExcel({ encontradosEnBajaFisicamente: true }),
      pdf: isGeneratingEncontradosBajaActivos, excel: isGeneratingEncontradosBajaActivosExcel,
    },
    encontradosEnBajaFisicamentePorRubro: {
      titulo: "Encontrados en Baja Fisicamente por Rubro",
      descripcion: "Mismo criterio que Encontrados en Baja Fisicamente, agrupado por rubro. Elija el formato.",
      onPDF: () => generateEncontradosPorRubro({ encontradosEnBajaFisicamente: true }),
      onExcel: () => generateEncontradosPorRubroExcel({ encontradosEnBajaFisicamente: true }),
      pdf: isGeneratingEncontradosPorRubro, excel: isGeneratingEncontradosPorRubroExcel,
    },
  };

  const activeFormato = formatoModalKey ? FORMATOS[formatoModalKey] : null;

  const unBoton = (key, label, className, title) => (
    <Button
      onClick={() => setFormatoModalKey(key)}
      disabled={busy}
      className={`w-full justify-center text-white min-h-11 !h-auto !py-2 text-[11px] sm:text-xs !whitespace-normal text-center leading-tight ${className}`}
      aria-label={`Abrir ${label}`}
      title={title}
    >
      <FileDown className="h-4 w-4 mr-2 shrink-0" />
      <span className="whitespace-normal break-words text-center leading-tight">{label}</span>
    </Button>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2 leading-tight">
          <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-blue-700 shrink-0" />
          REPORTES
        </h1>
        <p className="text-sm text-muted-foreground leading-tight">Reportes generales del inventario</p>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="p-3 sm:p-6">
          <CardTitle className="text-sm sm:text-base leading-tight">Reportes disponibles</CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0">
          {!canSeeReports ? (
            <p className="text-sm text-muted-foreground">No tiene acceso a estos reportes.</p>
          ) : (
            <div className="grid gap-2 w-full sm:grid-cols-4 sm:max-w-[1400px]">
              {unBoton("inventario", "INVENTARIO GENERAL", "bg-blue-700 hover:bg-blue-800", "Activos ultimoregistro=1 y estadoinventario no vacío, ordenados por código")}
              {unBoton("ubicacion", "REPORTE POR UBICACION", "bg-teal-700 hover:bg-teal-800", "Activos ultimoregistro=1 y estadoinventario no vacío, ordenados por ubicación")}
              {unBoton("rubro", "REPORTE POR RUBRO", "bg-purple-700 hover:bg-purple-800", "Total de activos por rubro (misma lógica del Inventario General)")}
              {unBoton("faltantes", "REPORTE FALTANTES", "bg-red-700 hover:bg-red-800", "Activos ultimoregistro=1 y estadoinventario vacío/nulo, excluyendo ciudades excepción")}
              {unBoton("pararevaluo", "ACTIVOS PARA REVALUO", "bg-amber-700 hover:bg-amber-800", "Activos pararevaluo=true: totales, con dato y faltantes")}
              {unBoton("reclasificar", "RECLASIFICAR EL RUBRO", "bg-orange-700 hover:bg-orange-800", "Activos vigentes a reclasificar: tipo no canónico -> destino por mayoría")}
              {unBoton("costo", "COSTO ACTUALIZADO Y DEPRECIACION", "bg-indigo-700 hover:bg-indigo-800", "Totales por rubro: Saldo Inicial, Costo Actualizado y Depreciación al 01/01/2026")}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="p-3 sm:p-6">
          <CardTitle className="text-sm sm:text-base leading-tight">REPORTES PRODUCTO 3</CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0">
          {!canSeeReports ? (
            <p className="text-sm text-muted-foreground">No tiene acceso a estos reportes.</p>
          ) : (
            <div className="grid gap-2 w-full sm:grid-cols-4 sm:max-w-[1400px] items-start">
              {unBoton("grupo", "GRUPO CONTABLE", "bg-indigo-700 hover:bg-indigo-800", "Agrupado por rubro (artemisaaltabaja=1)")}
              {unBoton("baja", "ACTIVOS DE BAJA", "bg-red-800 hover:bg-red-900", "Activos estado=0")}
              {unBoton("fungible", "FUNGIBLE", "bg-emerald-800 hover:bg-emerald-900", "Activos esactivo=false")}
              {unBoton("bajasEncontradas", "BAJAS ENCONTRADAS", "bg-stone-700 hover:bg-stone-800", "Activos estado=0, esactivo=true y con estadoinventario")}
              <div className="flex flex-col gap-2 w-full min-w-0">
                {unBoton("depreciacion", "DEPRECIACION", "bg-cyan-800 hover:bg-cyan-900", "Activos con código <= 43753, estadoinventario con dato, artemisaaltabaja 0/1 y ultimoregistro=1")}
                <Button
                  onClick={() => generateDepreciacionRecalculada({ recalcular: true })}
                  disabled={busy}
                  className="w-full justify-center text-white min-h-11 !h-auto !py-2 text-[11px] sm:text-xs !whitespace-normal text-center leading-tight bg-cyan-950 hover:bg-cyan-900"
                  aria-label="Recalcular Depreciación"
                  title="Fuerza Dep. Periodo = 1 en activos con Valor Neto negativo y recalcula Dep. Total y Valor Neto"
                >
                  <RefreshCw className="h-4 w-4 mr-2 shrink-0" />
                  <span className="whitespace-normal break-words text-center leading-tight">RECALCULAR DEPRECIACION</span>
                </Button>
                {unBoton("depreciacionPorRubro", "DEPRECIACION POR RUBRO", "bg-cyan-700 hover:bg-cyan-800", "Mismos activos que Depreciación agrupados por rubro, con valor neto total")}
              </div>
              <div className="flex flex-col gap-2 w-full min-w-0">
                {unBoton("obsoletos", "ACTIVOS OBSOLETOS", "bg-orange-800 hover:bg-orange-900", "Activos estadoconservacion=MALO")}
                {unBoton("maquinaria", "ACTIVOS DE MAQUINARIA Y EQUIPOS DE PRODUCCION", "bg-cyan-600 hover:bg-cyan-700", "Activos del rubro MAQUINARIA Y EQUIPOS DE PRODUCCION con su código y datos de depreciación")}
              </div>
              {unBoton("faltantesP3", "BIENES FALTANTES", "bg-amber-800 hover:bg-amber-900", "Activos ultimoregistro=1 sin estadoinventario")}
              <div className="flex flex-col gap-2 w-full min-w-0">
                {unBoton("sobrantes", "BIENES SOBRANTES", "bg-teal-800 hover:bg-teal-900", "Activos ultimoregistro=1 y activonuevo=TRUE")}
                {unBoton("sobrantesPorRubro", "SOBRANTES POR RUBRO", "bg-teal-700 hover:bg-teal-800", "Activos ultimoregistro=1 y activonuevo=TRUE, agrupados por rubro")}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="p-3 sm:p-6">
          <CardTitle className="text-sm sm:text-base leading-tight">REPORTES PRODUCTO 4</CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0">
          {!canSeeReports ? (
            <p className="text-sm text-muted-foreground">No tiene acceso a estos reportes.</p>
          ) : (
            <div className="grid gap-2 w-full sm:grid-cols-4 sm:max-w-[1400px]">
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => setIsEvaluacionModalOpen(true)}
                  disabled={busy}
                  className="w-full justify-center bg-sky-800 hover:bg-sky-900 text-white min-h-11 text-xs sm:text-sm"
                  aria-label="Abrir Evaluación Técnica por bloques"
                  title="Fichas por activo (estado=1, ultimoregistro=1, BUENO/REGULAR) para descargar en PDF o Excel por bloques de 300"
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  EVALUACION TECNICA
                </Button>
              </div>
              {unBoton("obsoletosP4", "ACTIVOS OBSOLETOS", "bg-orange-800 hover:bg-orange-900", "Fichas por activo (estado=1, MALO, sin edificaciones/biblioteca/terrenos)")}
              {unBoton("activo37713", "ACTIVO 37713", "bg-slate-700 hover:bg-slate-800", "Ficha del activo 37713 vigente")}
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => setIsObsoletosGrupoModalOpen(true)}
                  disabled={busy}
                  className="w-full justify-center bg-teal-700 hover:bg-teal-800 text-white min-h-11 text-xs sm:text-sm"
                  aria-label="Abrir Obsoletos por grupo contable"
                  title="Activos con ultimoregistro=1, estado=1 y MALO agrupados por rubro, sin biblioteca, edificaciones ni terrenos. Descargue en PDF o Excel"
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  OBSOLETOS POR GRUPO CONTABLE
                </Button>
              </div>
              {unBoton("rubrosExcluidos", "EDIF. BIBLIOTECA Y TERRENOS", "bg-orange-800 hover:bg-orange-900", "Activos vigentes de edificaciones, biblioteca y terrenos, agrupados por rubro")}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="p-3 sm:p-6">
          <CardTitle className="text-sm sm:text-base leading-tight">ENCONTRADOS / FALTANTES</CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0">
          {!canSeeReports ? (
            <p className="text-sm text-muted-foreground">No tiene acceso a estos reportes.</p>
          ) : (
            <div className="grid gap-3 w-full sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-2">
                {unBoton("estabanEnBaja", "ACTIVOS QUE ESTABAN EN BAJA", "bg-amber-700 hover:bg-amber-800", "Activos codigoactivo <= 43753, estadoinventario con dato, artemisaaltabaja=0, ultimoregistro=1, esactivo=true y estadoconservacion <> MALO")}
                {unBoton("estabanEnBajaPorRubro", "ACTIVOS QUE ESTABAN EN BAJA POR RUBRO", "bg-amber-600 hover:bg-amber-700", "Mismo criterio que Activos que Estaban en Baja, agrupado por rubro")}
              </div>
              <div className="flex flex-col gap-2">
                {unBoton("encontradosActivos", "ENCONTRADO BAJA SI SON ACTIVOS", "bg-emerald-700 hover:bg-emerald-800", "Activos codigoactivo <= 43753, estadoinventario con dato, artemisaaltabaja=0, ultimoregistro=1 y esactivo=true")}
                {unBoton("encontradosActivosPorRubro", "ENCONTRADO BAJA SI SON ACTIVOS POR RUBRO", "bg-emerald-600 hover:bg-emerald-700", "Mismo criterio que Encontrado Baja Si Son Activos, agrupado por rubro")}
              </div>
              <div className="flex flex-col gap-2">
                {unBoton("encontradosNoActivos", "ENCONTRADOS BAJA NO SON ACTIVOS", "bg-rose-700 hover:bg-rose-800", "Activos codigoactivo <= 43753, estadoinventario con dato, artemisaaltabaja=0, ultimoregistro=1 y esactivo=false")}
                {unBoton("encontradosNoActivosPorRubro", "ENCONTRADOS BAJA NO SON ACTIVOS POR RUBRO", "bg-rose-600 hover:bg-rose-700", "Mismo criterio que Encontrados Baja No Son Activos, agrupado por rubro")}
              </div>
              <div className="flex flex-col gap-2">
                {unBoton("encontradosEnBajaFisicamente", "ENCONTRADOS EN BAJA FISICAMENTE", "bg-rose-700 hover:bg-rose-800", "Activos codigoactivo <= 43753, estadoinventario con dato y artemisaaltabaja=0")}
                {unBoton("encontradosEnBajaFisicamentePorRubro", "ENCONTRADOS EN BAJA FISICAMENTE POR RUBRO", "bg-rose-600 hover:bg-rose-700", "Mismo criterio que Encontrados en Baja Fisicamente, agrupado por rubro")}
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => setIsEncontradosBajaModalOpen(true)}
                  disabled={busy}
                  className="w-full justify-center bg-slate-800 hover:bg-slate-900 text-white min-h-11 !h-auto !py-2 text-[11px] sm:text-xs !whitespace-normal text-center leading-tight"
                  aria-label="Abrir Encontrados en Estado Baja"
                  title="Activos con codigoactivo <=43753, estadoinventario no nulo ni vacío, artemisaaltabaja=0 y ultimoregistro=1: código, rubro, tipo, descripción, ubicación, responsable y carnet"
                >
                  <FileDown className="h-4 w-4 mr-2 shrink-0" />
                  <span className="whitespace-normal break-words text-center leading-tight">ENCONTRADOS EN ESTADO BAJA</span>
                </Button>
                {unBoton("encontradosPorRubro", "ENCONTRADOS POR RUBRO", "bg-slate-600 hover:bg-slate-700", "Mismo criterio que Encontrados en Estado Baja, agrupado por rubro")}
              </div>
              <div className="flex flex-col gap-2">
                {unBoton("encontradosFisicamente", "ENCONTRADOS FISICAMENTE", "bg-cyan-700 hover:bg-cyan-800", "Activos codigoactivo <= 43753, estadoinventario con dato y artemisaaltabaja=1")}
                {unBoton("encontradosFisicamentePorRubro", "ENCONTRADOS FISICAMENTE POR RUBRO", "bg-cyan-600 hover:bg-cyan-700", "Mismo criterio que Encontrados Fisicamente, agrupado por rubro")}
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => setIsFaltantesActivoModalOpen(true)}
                  disabled={busy}
                  className="w-full justify-center bg-zinc-700 hover:bg-zinc-800 text-white min-h-11 !h-auto !py-2 text-[11px] sm:text-xs !whitespace-normal text-center leading-tight"
                  aria-label="Abrir Faltantes en Estado Activo"
                  title="Activos con codigoactivo <=43753, estadoinventario NULL o vacío y artemisaaltabaja=1: código, rubro, tipo, descripción, ubicación, responsable y carnet"
                >
                  <FileDown className="h-4 w-4 mr-2 shrink-0" />
                  <span className="whitespace-normal break-words text-center leading-tight">FALTANTES EN ESTADO ACTIVO</span>
                </Button>
                {unBoton("faltantesPorRubro", "FALTANTES POR RUBRO", "bg-zinc-600 hover:bg-zinc-700", "Mismo criterio que Faltantes en Estado Activo, agrupado por rubro")}
              </div>
              <div className="flex flex-col gap-2">
                {unBoton("obsoleto", "OBSOLETO", "bg-orange-700 hover:bg-orange-800", "Activos codigoactivo <= 43753, estadoinventario con dato, artemisaaltabaja=1 y estadoconservacion = MALO")}
                {unBoton("obsoletoPorRubro", "OBSOLETO POR RUBRO", "bg-orange-600 hover:bg-orange-700", "Mismo criterio que Obsoleto, agrupado por rubro")}
              </div>
              <div className="flex flex-col gap-2">
                {unBoton("revaluo1355", "REVALUO 1355", "bg-fuchsia-700 hover:bg-fuchsia-800", "Activos con pararevaluo=true y activonuevo=false")}
                {unBoton("revaluo1355PorRubro", "REVALUO 1355 POR RUBRO", "bg-fuchsia-600 hover:bg-fuchsia-700", "Mismo criterio que Revaluo 1355, agrupado por rubro")}
              </div>
              <div className="flex flex-col gap-2">
                {unBoton("revaluo2553", "REVALUO 2553", "bg-violet-700 hover:bg-violet-800", "Activos con pararevaluo=true y activonuevo=false")}
                {unBoton("revaluo2553PorRubro", "REVALUO 2553 POR RUBRO", "bg-violet-600 hover:bg-violet-700", "Mismo criterio que Revaluo 2553, agrupado por rubro")}
              </div>
              <div className="flex flex-col gap-2">
                {unBoton("todoRevaluo", "TODO REVALUO", "bg-indigo-700 hover:bg-indigo-800", "Activos de los 3 grupos de revalúo (Estado Baja, No son MALO, Códigos nuevos)")}
                {unBoton("todoRevaluoPorRubro", "TODO REVALUO POR RUBRO", "bg-indigo-600 hover:bg-indigo-700", "Mismo criterio que Todo Revaluo, agrupado por rubro")}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ReporteFormatoModal
        open={formatoModalKey !== null}
        onOpenChange={(open) => { if (!open) setFormatoModalKey(null); }}
        title={activeFormato?.titulo || "Reporte"}
        description={activeFormato?.descripcion || "Elija el formato a descargar."}
        onPDF={activeFormato?.onPDF}
        onExcel={activeFormato?.onExcel}
        isGeneratingPDF={activeFormato?.pdf || false}
        isGeneratingExcel={activeFormato?.excel || false}
      />
      <EvaluacionTecnicaBloquesModal open={isEvaluacionModalOpen} onOpenChange={setIsEvaluacionModalOpen} />
      <ObsoletosGrupoModal open={isObsoletosGrupoModalOpen} onOpenChange={setIsObsoletosGrupoModalOpen} />
      <EncontradosBajaModal open={isEncontradosBajaModalOpen} onOpenChange={setIsEncontradosBajaModalOpen} />
      <FaltantesActivoModal open={isFaltantesActivoModalOpen} onOpenChange={setIsFaltantesActivoModalOpen} />
    </div>
  );
};

export default ReportesList;
