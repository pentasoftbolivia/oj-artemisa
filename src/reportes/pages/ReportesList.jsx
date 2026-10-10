import { FileDown, FileSpreadsheet, Loader2, BarChart3 } from "lucide-react";
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
import { useReporteActivosObsoletos } from "@/inicio/hooks/useReporteActivosObsoletos";
import { useReporteActivosObsoletosExcel } from "@/inicio/hooks/useReporteActivosObsoletosExcel";
import { useReporteBienesFaltantes } from "@/inicio/hooks/useReporteBienesFaltantes";
import { useReporteBienesFaltantesExcel } from "@/inicio/hooks/useReporteBienesFaltantesExcel";
import { useReporteBienesSobrantes } from "@/inicio/hooks/useReporteBienesSobrantes";
import { useReporteBienesSobrantesExcel } from "@/inicio/hooks/useReporteBienesSobrantesExcel";

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
  const { generate: generateObsoletos, isGenerating: isGeneratingObsoletos } = useReporteActivosObsoletos();
  const { generate: generateObsoletosExcel, isGenerating: isGeneratingObsoletosExcel } = useReporteActivosObsoletosExcel();
  const { generate: generateFaltantesP3, isGenerating: isGeneratingFaltantesP3 } = useReporteBienesFaltantes();
  const { generate: generateFaltantesP3Excel, isGenerating: isGeneratingFaltantesP3Excel } = useReporteBienesFaltantesExcel();
  const { generate: generateSobrantes, isGenerating: isGeneratingSobrantes } = useReporteBienesSobrantes();
  const { generate: generateSobrantesExcel, isGenerating: isGeneratingSobrantesExcel } = useReporteBienesSobrantesExcel();

  const busy = isGeneratingGeneral || isGeneratingGeneralExcel || isGeneratingUbicacion || isGeneratingUbicacionExcel || isGeneratingRubro || isGeneratingRubroExcel || isGeneratingFaltantes || isGeneratingFaltantesExcel || isGeneratingCosto || isGeneratingCostoExcel || isGeneratingParaRevaluo || isGeneratingParaRevaluoExcel || isGeneratingReclasificar || isGeneratingReclasificarExcel || isGeneratingGrupoContable || isGeneratingGrupoContableExcel || isGeneratingBaja || isGeneratingBajaExcel || isGeneratingObsoletos || isGeneratingObsoletosExcel || isGeneratingFaltantesP3 || isGeneratingFaltantesP3Excel || isGeneratingSobrantes || isGeneratingSobrantesExcel;

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
              <Button
                onClick={generateInventarioGeneral}
                disabled={busy}
                className="w-full justify-center bg-blue-700 hover:bg-blue-800 text-white min-h-11 text-xs sm:text-sm"
                aria-label="Generar Inventario General"
                title="PDF con todos los activos ultimoregistro=1 y estadoinventario no vacío, ordenados por código"
              >
                {isGeneratingGeneral ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4 mr-2" />
                )}
                INVENTARIO GENERAL
              </Button>
              <Button
                onClick={generatePorUbicacion}
                disabled={busy}
                className="w-full justify-center bg-teal-700 hover:bg-teal-800 text-white min-h-11 text-xs sm:text-sm"
                aria-label="Generar Reporte por Ubicación"
                title="PDF con todos los activos ultimoregistro=1 y estadoinventario no vacío, ordenados por ubicación (EL ALTO, LA PAZ, ...)"
              >
                {isGeneratingUbicacion ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4 mr-2" />
                )}
                REPORTE POR UBICACION
              </Button>
              <Button
                onClick={generatePorRubro}
                disabled={busy}
                className="w-full justify-center bg-purple-700 hover:bg-purple-800 text-white min-h-11 text-xs sm:text-sm"
                aria-label="Generar Reporte por Rubro"
                title="PDF con el total de activos por rubro (misma lógica del Inventario General)"
              >
                {isGeneratingRubro ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4 mr-2" />
                )}
                REPORTE POR RUBRO
              </Button>
              <Button
                onClick={generateFaltantes}
                disabled={busy}
                className="w-full justify-center bg-red-700 hover:bg-red-800 text-white min-h-11 text-xs sm:text-sm"
                aria-label="Generar Reporte Faltantes"
                title="PDF por ubicación con activos ultimoregistro=1 y estadoinventario vacío/nulo, excluyendo ciudades excepción"
              >
                {isGeneratingFaltantes ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4 mr-2" />
                )}
                REPORTE FALTANTES
              </Button>
              <Button
                onClick={generateInventarioGeneralExcel}
                disabled={busy}
                className="w-full justify-center bg-green-700 hover:bg-green-800 text-white min-h-11 text-xs sm:text-sm"
                aria-label="Generar Inventario General en Excel"
                title="Excel con todos los activos ultimoregistro=1 y estadoinventario no vacío, ordenados por código"
              >
                {isGeneratingGeneralExcel ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                )}
                INVENTARIO GENERAL EXCEL
              </Button>
              <Button
                onClick={generatePorUbicacionExcel}
                disabled={busy}
                className="w-full justify-center bg-green-700 hover:bg-green-800 text-white min-h-11 text-xs sm:text-sm"
                aria-label="Generar Reporte por Ubicación en Excel"
                title="Excel con todos los activos ultimoregistro=1 y estadoinventario no vacío, ordenados por ubicación (EL ALTO, LA PAZ, ...)"
              >
                {isGeneratingUbicacionExcel ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                )}
                REPORTE POR UBICACION EXCEL
              </Button>
              <Button
                onClick={generatePorRubroExcel}
                disabled={busy}
                className="w-full justify-center bg-green-700 hover:bg-green-800 text-white min-h-11 text-xs sm:text-sm"
                aria-label="Generar Reporte por Rubro en Excel"
                title="Excel con el total de activos por rubro (misma lógica del Inventario General)"
              >
                {isGeneratingRubroExcel ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                )}
                REPORTE POR RUBRO EXCEL
              </Button>
              <Button
                onClick={generateFaltantesExcel}
                disabled={busy}
                className="w-full justify-center bg-green-700 hover:bg-green-800 text-white min-h-11 text-xs sm:text-sm"
                aria-label="Generar Reporte Faltantes en Excel"
                title="Excel por ubicación con activos ultimoregistro=1 y estadoinventario vacío/nulo, excluyendo ciudades excepción"
              >
                {isGeneratingFaltantesExcel ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                )}
                REPORTE FALTANTES EXCEL
              </Button>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={generateParaRevaluo}
                  disabled={busy}
                  className="w-full justify-center bg-amber-700 hover:bg-amber-800 text-white min-h-11 text-xs sm:text-sm"
                  aria-label="Generar Activos para Revalúo en PDF"
                  title="PDF con todos los activos pararevaluo=true: totales, con dato en estadoinventario y faltantes sin dato"
                >
                  {isGeneratingParaRevaluo ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4 mr-2" />
                  )}
                  ACTIVOS PARA REVALUO
                </Button>
                <Button
                  onClick={generateParaRevaluoExcel}
                  disabled={busy}
                  className="w-full justify-center bg-green-700 hover:bg-green-800 text-white min-h-11 text-xs sm:text-sm"
                  aria-label="Generar Activos para Revalúo en Excel"
                  title="Excel con todos los activos pararevaluo=true: Resumen, ConEstado y Faltantes"
                >
                  {isGeneratingParaRevaluoExcel ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                  )}
                  ACTIVOS PARA REVALUO EXCEL
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={generateReclasificar}
                  disabled={busy}
                  className="w-full justify-center bg-orange-700 hover:bg-orange-800 text-white min-h-11 text-xs sm:text-sm"
                  aria-label="Generar Reclasificar el Rubro en PDF"
                  title="PDF con activos vigentes a reclasificar: tipo no canónico -> destino por mayoría"
                >
                  {isGeneratingReclasificar ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4 mr-2" />
                  )}
                  RECLASIFICAR EL RUBRO
                </Button>
                <Button
                  onClick={generateReclasificarExcel}
                  disabled={busy}
                  className="w-full justify-center bg-green-700 hover:bg-green-800 text-white min-h-11 text-xs sm:text-sm"
                  aria-label="Generar Reclasificar el Rubro en Excel"
                  title="Excel con activos vigentes a reclasificar: hojas Resumen y Detalle"
                >
                  {isGeneratingReclasificarExcel ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                  )}
                  RECLASIFICAR EL RUBRO EXCEL
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={generateCosto}
                  disabled={busy}
                  className="w-full justify-center bg-indigo-700 hover:bg-indigo-800 text-white min-h-11 text-xs sm:text-sm"
                aria-label="Generar Costo Actualizado y Depreciación"
                title="PDF con totales por rubro desde Excel local: Saldo Inicial, Costo Actualizado y Depreciación al 01/01/2026 (UltimoRegistro=1 y Se_Imprime=1)"
                >
                  {isGeneratingCosto ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4 mr-2" />
                  )}
                  COSTO ACTUALIZADO Y DEPRECIACION
                </Button>
                <Button
                  onClick={generateCostoExcel}
                  disabled={busy}
                  className="w-full justify-center bg-green-700 hover:bg-green-800 text-white min-h-11 text-xs sm:text-sm"
                aria-label="Generar Costo Actualizado y Depreciación en Excel"
                title="Excel con totales por rubro desde Excel local: Saldo Inicial, Costo Actualizado y Depreciación al 01/01/2026 (UltimoRegistro=1 y Se_Imprime=1)"
                >
                  {isGeneratingCostoExcel ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                  )}
                  COSTO ACTUALIZADO Y DEPRECIACION EXCEL
                </Button>
              </div>
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
            <div className="grid gap-2 w-full sm:grid-cols-4 sm:max-w-[1400px]">
              <div className="flex flex-col gap-2">
                <Button
                  onClick={generateGrupoContable}
                  disabled={busy}
                  className="w-full justify-center bg-indigo-700 hover:bg-indigo-800 text-white min-h-11 text-xs sm:text-sm"
                aria-label="Generar Grupo Contable en PDF"
                title="PDF agrupado por rubro con cantidad de activos (ultimoregistro=1, REVISADO/INVENTARIADO). Excluye Biblioteca, Terrenos y Edificaciones"
                >
                  {isGeneratingGrupoContable ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4 mr-2" />
                  )}
                  GRUPO CONTABLE PDF
                </Button>
                <Button
                  onClick={generateGrupoContableExcel}
                  disabled={busy}
                  className="w-full justify-center bg-green-700 hover:bg-green-800 text-white min-h-11 text-xs sm:text-sm"
                aria-label="Generar Grupo Contable en Excel"
                title="Excel agrupado por rubro con cantidad de activos (ultimoregistro=1, REVISADO/INVENTARIADO). Excluye Biblioteca, Terrenos y Edificaciones"
                >
                  {isGeneratingGrupoContableExcel ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                  )}
                  GRUPO CONTABLE EXCEL
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={generateBaja}
                  disabled={busy}
                  className="w-full justify-center bg-red-800 hover:bg-red-900 text-white min-h-11 text-xs sm:text-sm"
                  aria-label="Generar Activos de Baja en PDF"
                  title="PDF con activos estado=0 o esactivo=false: código, rubro, tipo, descripción, ubicación, responsable y carnet"
                >
                  {isGeneratingBaja ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4 mr-2" />
                  )}
                  ACTIVOS DE BAJA PDF
                </Button>
                <Button
                  onClick={generateBajaExcel}
                  disabled={busy}
                  className="w-full justify-center bg-green-700 hover:bg-green-800 text-white min-h-11 text-xs sm:text-sm"
                  aria-label="Generar Activos de Baja en Excel"
                  title="Excel con activos estado=0 o esactivo=false: código, rubro, tipo, descripción, ubicación, responsable y carnet"
                >
                  {isGeneratingBajaExcel ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                  )}
                  ACTIVOS DE BAJA EXCEL
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={generateObsoletos}
                  disabled={busy}
                  className="w-full justify-center bg-orange-800 hover:bg-orange-900 text-white min-h-11 text-xs sm:text-sm"
                  aria-label="Generar Activos Obsoletos en PDF"
                  title="PDF con activos estadoconservacion=MALO: código, rubro, tipo, descripción, ubicación, responsable y carnet"
                >
                  {isGeneratingObsoletos ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4 mr-2" />
                  )}
                  ACTIVOS OBSOLETOS PDF
                </Button>
                <Button
                  onClick={generateObsoletosExcel}
                  disabled={busy}
                  className="w-full justify-center bg-green-700 hover:bg-green-800 text-white min-h-11 text-xs sm:text-sm"
                  aria-label="Generar Activos Obsoletos en Excel"
                  title="Excel con activos estadoconservacion=MALO: código, rubro, tipo, descripción, ubicación, responsable y carnet"
                >
                  {isGeneratingObsoletosExcel ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                  )}
                  ACTIVOS OBSOLETOS EXCEL
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={generateFaltantesP3}
                  disabled={busy}
                  className="w-full justify-center bg-amber-800 hover:bg-amber-900 text-white min-h-11 text-xs sm:text-sm"
                  aria-label="Generar Bienes Faltantes en PDF"
                  title="PDF con activos ultimoregistro=1 sin estadoinventario: código, rubro, tipo, descripción, ubicación, responsable y carnet"
                >
                  {isGeneratingFaltantesP3 ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4 mr-2" />
                  )}
                  BIENES FALTANTES PDF
                </Button>
                <Button
                  onClick={generateFaltantesP3Excel}
                  disabled={busy}
                  className="w-full justify-center bg-green-700 hover:bg-green-800 text-white min-h-11 text-xs sm:text-sm"
                  aria-label="Generar Bienes Faltantes en Excel"
                  title="Excel con activos ultimoregistro=1 sin estadoinventario: código, rubro, tipo, descripción, ubicación, responsable y carnet"
                >
                  {isGeneratingFaltantesP3Excel ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                  )}
                  BIENES FALTANTES EXCEL
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={generateSobrantes}
                  disabled={busy}
                  className="w-full justify-center bg-teal-800 hover:bg-teal-900 text-white min-h-11 text-xs sm:text-sm"
                  aria-label="Generar Bienes Sobrantes en PDF"
                  title="PDF con activos ultimoregistro=1 y activonuevo=TRUE: código, rubro, tipo, descripción, ubicación, responsable y carnet"
                >
                  {isGeneratingSobrantes ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4 mr-2" />
                  )}
                  BIENES SOBRANTES PDF
                </Button>
                <Button
                  onClick={generateSobrantesExcel}
                  disabled={busy}
                  className="w-full justify-center bg-green-700 hover:bg-green-800 text-white min-h-11 text-xs sm:text-sm"
                  aria-label="Generar Bienes Sobrantes en Excel"
                  title="Excel con activos ultimoregistro=1 y activonuevo=TRUE: código, rubro, tipo, descripción, ubicación, responsable y carnet"
                >
                  {isGeneratingSobrantesExcel ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                  )}
                  BIENES SOBRANTES EXCEL
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportesList;
