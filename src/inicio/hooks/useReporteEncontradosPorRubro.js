import { useState, useCallback } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/lib/supabase";
import { getCachedCatalog } from "@/lib/catalogCache";
import { toCamelCaseArray } from "@/lib/mapFields";
import { useToast } from "@/hooks/use-toast";
import { LOGO_JPG_DATA_URL } from "@/lib/logoJpgBase64";
import { ACTIVO_COLUMNS } from "@/lib/activoColumns";
import { buildParamTasaMap, resolveTasaFromParams } from "../constants/depreciacionConstants";

const formatError = (err) => {
  if (!err) return "Error desconocido";
  const code = err?.code ? `[${err.code}] ` : "";
  const message = err?.message || err?.details || err?.hint || err?.error_description;
  if (message) return `${code}${message}`;
  try {
    const str = JSON.stringify(err);
    return str && str !== "{}" ? `${code}${str}` : `${code}${String(err)}`;
  } catch {
    return `${code}${String(err)}`;
  }
};

const LOGO_W = 32;
const LOGO_H = LOGO_W * (57 / 256);

const fmtMoney = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0,0000";
  return n.toLocaleString("es-BO", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
};

const parseNum = (v) => {
  if (v === null || v === undefined || String(v).trim() === "") return 0;
  const n = Number(String(v).replace(",", "."));
  return isNaN(n) ? 0 : n;
};

const DEP_HEADERS = ["N°", "Rubro", "Activos", "Costo Total Actualizado al 09/10/2026", "Depreciacion Total", "Valor Neto"];

const addLogo = (doc) => {
  try {
    doc.addImage(LOGO_JPG_DATA_URL, "JPEG", 14, 8, LOGO_W, LOGO_H);
  } catch {
    // El logo es opcional: si falla la carga, se genera el PDF sin logo.
  }
};

/**
 * Reporte ENCONTRADOS POR RUBRO (PDF).
 * Mismo criterio que ENCONTRADOS EN ESTADO BAJA:
 * codigoactivo <= 43753 AND estadoinventario IS NOT NULL AND estadoinventario <> ''
 * AND artemisaaltabaja=0 AND ultimoregistro=1.
 * Con la opción soloActivos agrega AND esactivo=true.
 * Agrupado por rubro: nombre del rubro + total de activos.
 * Con la opción todoRevaluo agrega la columna Valor Revalúo, sumando
 * act_activos.valorrevaluo por rubro.
 */
export const useReporteEncontradosPorRubro = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async (options = {}) => {
  const soloActivos = options?.soloActivos === true;
  const soloNoActivos = options?.soloNoActivos === true;
  const enAlta = options?.enAlta === true;
  const estabanEnBaja = options?.estabanEnBaja === true;
  const obsoleto = options?.obsoleto === true;
  const recalcular = options?.recalcular === true;
  const todoRevaluo = options?.todoRevaluo === true;
  const revaluo2553 = options?.revaluo2553 === true;
  const revaluo1355 = options?.revaluo1355 === true;
  const encontradosFisicamente = options?.encontradosFisicamente === true;
  const encontradosEnBajaFisicamente = options?.encontradosEnBajaFisicamente === true;
  const conDetalleDep = recalcular && obsoleto;
    setIsGenerating(true);
    try {
      toast({ title: "Generando Encontrados por Rubro", description: "Cargando catálogos..." });

      const [rubros, tipoRubros, paramDep] = await Promise.all([
        getCachedCatalog("act_rubro"),
        getCachedCatalog("act_tiporubro"),
        conDetalleDep
          ? supabase.from("act_param_depreciacion").select("rubro,tasa_anual").then(({ data, error }) => {
              if (error) throw error;
              return data || [];
            })
          : Promise.resolve([]),
      ]);
      const paramTasaMap = conDetalleDep ? buildParamTasaMap(paramDep) : new Map();

      const rubroDescMap = {};
      (rubros || []).forEach((r) => {
        rubroDescMap[r.codigorubroact] = r.descripcionrubroact;
        rubroDescMap[String(r.codigorubroact)] = r.descripcionrubroact;
      });
      const rubroFromTipo = {};
      (tipoRubros || []).forEach((t) => {
        rubroFromTipo[t.tiporubroact] = rubroDescMap[t.codigorubroact];
        rubroFromTipo[String(t.tiporubroact)] = rubroDescMap[t.codigorubroact];
      });

      toast({ title: "Cargando activos", description: "Obteniendo encontrados en estado baja..." });

      let allActivos = [];
      let from = 0;
      const FETCH_CHUNK = 1000;
      while (true) {
        // SELECT * FROM act_activos WHERE codigoactivo <= 43753
        // AND estadoinventario IS NOT NULL AND estadoinventario <> ''
        // AND artemisaaltabaja=0 AND ultimoregistro=1
        // AND esactivo=true (solo cuando soloActivos)
        // AND esactivo=false (solo cuando soloNoActivos)
        let query = supabase
          .from("act_activos")
          .select(`${ACTIVO_COLUMNS},artemisaaltabaja,esactivo,estadoconservacion,activonuevo,pararevaluo,valorrevaluo${conDetalleDep ? ",saldoinicial_exp,depacum_exp,pordepanu,actdepacum_exp,depacumtotal_exp,costactuali_exp" : ""}`);
        if (todoRevaluo) {
          // OR exacto de los 3 grupos de revalúo. Sin los filtros base globales:
          // el grupo 3 solo exige activonuevo=true.
          query = query.or([
            "and(codigoactivo.lte.43753,artemisaaltabaja.eq.0,ultimoregistro.eq.1,esactivo.eq.true,estadoconservacion.neq.MALO)",
            "and(codigoactivo.lte.43753,artemisaaltabaja.eq.1,pararevaluo.eq.true,activonuevo.eq.false,estadoconservacion.neq.MALO)",
            "activonuevo.eq.true",
          ].join(","));
        } else {
          query = query
            .lte("codigoactivo", 43753)
            .not("estadoinventario", "is", null)
            .neq("estadoinventario", "")
            .eq("ultimoregistro", 1);
          if (revaluo1355) query = query.eq("artemisaaltabaja", 1).eq("pararevaluo", true).eq("activonuevo", false).neq("estadoconservacion", "MALO");
          else if (revaluo2553) query = query.eq("artemisaaltabaja", 1).eq("pararevaluo", true).eq("activonuevo", false).neq("estadoconservacion", "MALO");
          else if (encontradosFisicamente) query = query.in("artemisaaltabaja", [0, 1]).eq("esactivo", true);
          else if (encontradosEnBajaFisicamente) query = query.eq("artemisaaltabaja", 0);
          else if (obsoleto) query = query.eq("artemisaaltabaja", 1).eq("estadoconservacion", "MALO");
          else if (estabanEnBaja) query = query.eq("artemisaaltabaja", 0).eq("esactivo", true).neq("estadoconservacion", "MALO");
          else if (soloActivos) query = query.eq("artemisaaltabaja", 0).eq("esactivo", true);
          else if (soloNoActivos) query = query.eq("artemisaaltabaja", 0).eq("esactivo", false);
          else query = query.eq("artemisaaltabaja", 0);
        }
        const { data, error } = await query
          .order("codigoactivointerno", { ascending: true })
          .range(from, from + FETCH_CHUNK - 1);
        if (error) throw error;
        const batch = toCamelCaseArray(data || []);
        if (batch.length === 0) break;
        allActivos = allActivos.concat(batch);
        if (batch.length < FETCH_CHUNK) break;
        from += FETCH_CHUNK;
        if (allActivos.length > 100000) break;
        await new Promise((r) => setTimeout(r, 0));
      }

      allActivos = allActivos.filter((a) => {
        if (todoRevaluo) {
          const codigoActivo = Number(a.codigoActivo ?? a.codigoactivo ?? 0);
          const estInv = String(a.estadoinventario ?? a.estadoInventario ?? "").trim();
          const tieneEstInv = estInv !== "";
          const esUltimo = String(a.ultimoregistro ?? a.ultimoRegistro ?? "").trim() === "1";
          const artemisa = Number(a.artemisaaltabaja ?? a.artemisaAltaBaja ?? NaN);
          const esActivoRaw = a.esactivo ?? a.esActivo;
          const esActivo = esActivoRaw === true || String(esActivoRaw).trim().toUpperCase() === "TRUE" || Number(esActivoRaw) === 1;
          const pararevaluoRaw = a.pararevaluo ?? a.paraRevaluo;
          const esParaRevaluo = pararevaluoRaw === true || String(pararevaluoRaw).trim().toUpperCase() === "TRUE" || Number(pararevaluoRaw) === 1;
          const activoNuevoRaw = a.activonuevo ?? a.activoNuevo;
          const esActivoNuevo = activoNuevoRaw === true || String(activoNuevoRaw).trim().toUpperCase() === "TRUE" || Number(activoNuevoRaw) === 1;
          const esMalo = String(a.estadoconservacion ?? a.estadoConservacion ?? "").trim().toUpperCase() === "MALO";

          const grupo1 = codigoActivo <= 43753 && tieneEstInv && artemisa === 0 && esUltimo && esActivo && !esMalo;
          const grupo2 = codigoActivo <= 43753 && tieneEstInv && artemisa === 1 && esParaRevaluo && !esActivoNuevo && !esMalo;
          const grupo3 = esActivoNuevo;

          return grupo1 || grupo2 || grupo3;
        }
        const estInv = String(a.estadoinventario ?? a.estadoInventario ?? "").trim();
        if (estInv === "") return false;
        const v = a.artemisaaltabaja ?? a.artemisaAltaBaja;
        const codigoActivo = Number(a.codigoActivo ?? a.codigoactivo ?? 0);
        if (encontradosEnBajaFisicamente) {
          const v = a.artemisaaltabaja ?? a.artemisaAltaBaja;
          const codigoActivo = Number(a.codigoActivo ?? a.codigoactivo ?? 0);
          const estInv = String(a.estadoinventario ?? a.estadoInventario ?? "").trim();
          if (estInv === "") return false;
          if (Number(v) !== 0) return false;
          if (codigoActivo > 43753) return false;
          if (a.ultimoregistro != 1) return false;
        } else if (encontradosFisicamente) {
          const v = a.artemisaaltabaja ?? a.artemisaAltaBaja;
          const codigoActivo = Number(a.codigoActivo ?? a.codigoactivo ?? 0);
          const estInv = String(a.estadoinventario ?? a.estadoInventario ?? "").trim();
          const esActivo = a.esactivo ?? a.esActivo;
          if (estInv === "") return false;
          if (!(Number(v) === 0 || Number(v) === 1)) return false;
          if (esActivo == null) return false;
          if (!(esActivo === true || String(esActivo).toLowerCase() === "true" || Number(esActivo) === 1)) return false;
          if (codigoActivo > 43753) return false;
          if (a.ultimoregistro != 1) return false;
        } else         if (revaluo1355) {
          const pv = a.pararevaluo ?? a.paraRevaluo;
          const esPV = pv === true || String(pv).trim().toUpperCase() === "TRUE" || Number(pv) === 1;
          const an = a.activonuevo ?? a.activoNuevo;
          const esAN = an === true || String(an).trim().toUpperCase() === "TRUE" || Number(an) === 1;
          const v = a.artemisaaltabaja ?? a.artemisaAltaBaja;
          const ec = String(a.estadoconservacion ?? a.estadoConservacion ?? "").trim().toUpperCase();
          if (!esPV || esAN) return false;
          if (Number(v) !== 1) return false;
          if (ec === "MALO") return false;
        } else if (revaluo2553) {
          const pv = a.pararevaluo ?? a.paraRevaluo;
          const esPV = pv === true || String(pv).trim().toUpperCase() === "TRUE" || Number(pv) === 1;
          const an = a.activonuevo ?? a.activoNuevo;
          const esAN = an === true || String(an).trim().toUpperCase() === "TRUE" || Number(an) === 1;
          const v = a.artemisaaltabaja ?? a.artemisaAltaBaja;
          const ec = String(a.estadoconservacion ?? a.estadoConservacion ?? "").trim().toUpperCase();
          if (!esPV || esAN) return false;
          if (Number(v) !== 1) return false;
          if (ec === "MALO") return false;
        } else if (obsoleto) {
          if (!(Number(v) === 1)) return false;
          const ec = String(a.estadoconservacion ?? a.estadoConservacion ?? "").trim().toUpperCase();
          if (ec !== "MALO") return false;
        } else if (estabanEnBaja) {
          if (!(Number(v) === 0)) return false;
          const esActivo = a.esactivo ?? a.esActivo;
          if (esActivo == null) return false;
          if (!(esActivo === true || String(esActivo).toLowerCase() === "true" || Number(esActivo) === 1)) return false;
          const ec = String(a.estadoconservacion ?? a.estadoConservacion ?? "").trim().toUpperCase();
          if (ec === "MALO") return false;
        } else if (enAlta) {
          if (!(Number(v) === 1)) return false;
          const esActivo = a.esactivo ?? a.esActivo;
          if (esActivo == null) return false;
          if (!(esActivo === true || String(esActivo).toLowerCase() === "true" || Number(esActivo) === 1)) return false;
        } else if (soloActivos) {
          if (!(Number(v) === 0)) return false;
          const esActivo = a.esactivo ?? a.esActivo;
          if (esActivo == null) return false;
          if (!(esActivo === true || String(esActivo).toLowerCase() === "true" || Number(esActivo) === 1)) return false;
        } else if (soloNoActivos) {
          if (!(Number(v) === 0)) return false;
          const esActivo = a.esactivo ?? a.esActivo;
          if (esActivo == null) return false;
          if (!(esActivo === false || String(esActivo).toLowerCase() === "false" || Number(esActivo) === 0)) return false;
        } else {
          if (!(Number(v) === 0)) return false;
        }
        return codigoActivo <= 43753 && a.ultimoregistro == 1;
      });

      if (allActivos.length === 0) {
        toast({ title: "Sin datos", description: "No hay activos encontrados en estado baja.", variant: "destructive" });
        return;
      }

      const conteoPorRubro = new Map();
      const valorRevaluoPorRubro = new Map();
      const gruposDep = new Map();
      allActivos.forEach((a) => {
        const tipo = a.tipoRubroAct ?? a.tiporubroact;
        const rubroDesc = String(rubroFromTipo[tipo] ?? rubroFromTipo[String(tipo)] ?? "SIN RUBRO").trim() || "SIN RUBRO";
        conteoPorRubro.set(rubroDesc, (conteoPorRubro.get(rubroDesc) ?? 0) + 1);
        valorRevaluoPorRubro.set(
          rubroDesc,
          (valorRevaluoPorRubro.get(rubroDesc) ?? 0) + (Number(a.valorRevaluo ?? a.valorrevaluo) || 0)
        );

        if (!conDetalleDep) return;

        const saldoInicial = parseNum(a.saldoInicialExp ?? a.saldoinicial_exp);
        const depAcum = parseNum(a.depAcumExp ?? a.depacum_exp);
        const costoAct = parseNum(a.porDepAnu ?? a.pordepanu);
        const depActualizada = parseNum(a.actDepAcumExp ?? a.actdepacum_exp);
        const depAcumTotal = parseNum(a.depAcumTotalExp ?? a.depacumtotal_exp);
        const costoTotal0910 = parseNum(a.costActualiExp ?? a.costactuali_exp);
        const revaluo = parseNum(a.valorRevaluo ?? a.valorrevaluo);
        const costoTotalRevaluado = costoTotal0910 + revaluo;
        const tasaAnual = resolveTasaFromParams(rubroDesc, paramTasaMap);
        const depMesRaw = tasaAnual !== null && tasaAnual !== undefined ? tasaAnual / 12 : null;
        const depMes = depMesRaw !== null && depMesRaw !== undefined ? Number(depMesRaw.toFixed(8)) : null;
        const depPeriodo = depMes !== null ? (depMes * 10) * costoTotal0910 : null;
        const depTotal = depAcumTotal !== null && depPeriodo !== null ? depAcumTotal + depPeriodo : null;
        const valorNeto = depTotal !== null ? costoTotalRevaluado - depTotal : null;

        let depPeriodoMostrar = depPeriodo;
        let depTotalMostrar = depTotal;
        let valorNetoMostrar = valorNeto;
        if (recalcular && valorNeto !== null && valorNeto < 0) {
          depPeriodoMostrar = 1;
          depTotalMostrar = depAcumTotal !== null ? depAcumTotal + 1 : null;
          valorNetoMostrar = depTotalMostrar !== null ? costoTotalRevaluado - depTotalMostrar : null;
        }

        if (!gruposDep.has(rubroDesc)) {
          gruposDep.set(rubroDesc, {
            activos: 0, saldoInicial: 0, depAcum: 0, costoAct: 0, depActualizada: 0,
            depAcumTotal: 0, depMes: null, depPeriodo: 0, costoTotal0910: 0, revaluo: 0,
            costoTotalRevaluado: 0, depTotal: 0, valorNeto: 0,
          });
        }
        const g = gruposDep.get(rubroDesc);
        g.activos += 1;
        g.saldoInicial += saldoInicial;
        g.depAcum += depAcum;
        g.costoAct += costoAct;
        g.depActualizada += depActualizada;
        g.depAcumTotal += depAcumTotal;
        if (g.depMes === null && depMes !== null) g.depMes = depMes;
        g.depPeriodo += depPeriodoMostrar ?? 0;
        g.costoTotal0910 += costoTotal0910;
        g.revaluo += revaluo;
        g.costoTotalRevaluado += costoTotalRevaluado;
        g.depTotal += depTotalMostrar ?? 0;
        g.valorNeto += valorNetoMostrar ?? 0;
      });
      const rubrosOrdenados = [...conteoPorRubro.keys()].sort((x, y) => x.localeCompare(y, "es"));
      const totalRevaluo = allActivos.reduce((s, a) => s + (Number(a.valorRevaluo ?? a.valorrevaluo) || 0), 0);

      let totDep = null;
      let body;
      if (conDetalleDep) {
        body = rubrosOrdenados.map((rubro, idx) => {
          const g = gruposDep.get(rubro);
          return [
            String(idx + 1),
            rubro,
            String(g.activos),
            fmtMoney(g.costoTotal0910),
            fmtMoney(g.depTotal),
            fmtMoney(g.valorNeto),
          ];
        });
        totDep = rubrosOrdenados.reduce((acc, rubro) => {
          const g = gruposDep.get(rubro);
          acc.activos += g.activos;
          acc.saldoInicial += g.saldoInicial;
          acc.depAcum += g.depAcum;
          acc.costoAct += g.costoAct;
          acc.depActualizada += g.depActualizada;
          acc.depAcumTotal += g.depAcumTotal;
          acc.depPeriodo += g.depPeriodo;
          acc.costoTotal0910 += g.costoTotal0910;
          acc.revaluo += g.revaluo;
          acc.costoTotalRevaluado += g.costoTotalRevaluado;
          acc.depTotal += g.depTotal;
          acc.valorNeto += g.valorNeto;
          return acc;
        }, {
          activos: 0, saldoInicial: 0, depAcum: 0, costoAct: 0, depActualizada: 0,
          depAcumTotal: 0, depPeriodo: 0, costoTotal0910: 0, revaluo: 0,
          costoTotalRevaluado: 0, depTotal: 0, valorNeto: 0,
        });
      } else {
        body = rubrosOrdenados.map((rubro, idx) => [
          String(idx + 1),
          rubro,
          String(conteoPorRubro.get(rubro)),
          ...(todoRevaluo ? [fmtMoney(valorRevaluoPorRubro.get(rubro) ?? 0)] : []),
        ]);
      }

      toast({ title: "Generando PDF", description: `Construyendo reporte con ${rubrosOrdenados.length} rubros...` });

      const doc = new jsPDF({ orientation: conDetalleDep ? "landscape" : "portrait", unit: "mm", format: "letter" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      addLogo(doc);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(encontradosEnBajaFisicamente ? "ENCONTRADOS EN BAJA FISICAMENTE POR RUBRO - ÓRGANO JUDICIAL" : encontradosFisicamente ? "ENCONTRADOS FISICAMENTE POR RUBRO - ÓRGANO JUDICIAL" : revaluo1355 ? "REVALUO 1355 POR RUBRO - ÓRGANO JUDICIAL" : revaluo2553 ? "REVALUO 2553 POR RUBRO - ÓRGANO JUDICIAL" : todoRevaluo ? "TODO REVALUO POR RUBRO - ÓRGANO JUDICIAL" : recalcular && obsoleto ? "RECALCULAR OBSOLETO POR RUBRO - ÓRGANO JUDICIAL" : obsoleto ? "OBSOLETO POR RUBRO - ÓRGANO JUDICIAL" : estabanEnBaja ? "ACTIVOS QUE ESTABAN EN BAJA POR RUBRO - ÓRGANO JUDICIAL" : enAlta ? "ENCONTRADO BAJA SI SON ACTIVOS POR RUBRO - ÓRGANO JUDICIAL" : soloActivos ? "ENCONTRADO BAJA SI SON ACTIVOS POR RUBRO - ÓRGANO JUDICIAL" : soloNoActivos ? "ENCONTRADOS BAJA NO SON ACTIVOS POR RUBRO - ÓRGANO JUDICIAL" : "ENCONTRADOS POR RUBRO - ÓRGANO JUDICIAL", pageWidth / 2, conDetalleDep ? 16 : 20, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Total activos: ${allActivos.length} en ${rubrosOrdenados.length} rubros`, pageWidth / 2, conDetalleDep ? 21 : 25, { align: "center" });

      if (conDetalleDep) {
        autoTable(doc, {
          startY: 26,
          head: [DEP_HEADERS],
          body,
          foot: [[
            "",
            "TOTAL GENERAL",
            String(totDep.activos),
            fmtMoney(totDep.costoTotal0910),
            fmtMoney(totDep.depTotal),
            fmtMoney(totDep.valorNeto),
          ]],
          showFoot: "lastPage",
          theme: "striped",
          styles: { font: "helvetica", fontSize: 8, cellPadding: 1.8, overflow: "linebreak", valign: "middle" },
          headStyles: { fillColor: [16, 70, 140], textColor: [255, 255, 255], halign: "center", fontStyle: "bold", fontSize: 8 },
          footStyles: { fillColor: [230, 240, 255], textColor: [16, 70, 140], halign: "right", fontStyle: "bold", fontSize: 8 },
          columnStyles: {
            0: { cellWidth: 10, halign: "center" },
            1: { cellWidth: 95, halign: "left" },
            2: { cellWidth: 15, halign: "center" },
            3: { cellWidth: 50, halign: "right" },
            4: { cellWidth: 48, halign: "right" },
            5: { cellWidth: 45, halign: "right" },
          },
          margin: { top: 26, left: 8, right: 8 },
        });
      } else {
        const tableWidth = todoRevaluo ? 12 + 95 + 30 + 40 : 12 + 120 + 30;
        const marginLeft = (pageWidth - tableWidth) / 2;
        autoTable(doc, {
          startY: 30,
          head: [[
            "N°", "Rubro", "Total Activos",
            ...(todoRevaluo ? ["Valor Revalúo"] : []),
          ]],
          body,
          foot: [[
            "", "TOTAL GENERAL", String(allActivos.length),
            ...(todoRevaluo ? [fmtMoney(totalRevaluo)] : []),
          ]],
          showFoot: "lastPage",
          theme: "striped",
          tableWidth,
          styles: { font: "helvetica", fontSize: 8, cellPadding: 1.8, overflow: "linebreak", valign: "middle" },
          headStyles: { fillColor: [16, 70, 140], textColor: [255, 255, 255], halign: "center", fontStyle: "bold", fontSize: 8 },
          footStyles: { fillColor: [230, 240, 255], textColor: [16, 70, 140], halign: "center", fontStyle: "bold", fontSize: 8 },
          columnStyles: todoRevaluo
            ? {
                0: { cellWidth: 12, halign: "center" },
                1: { cellWidth: 95, halign: "left" },
                2: { cellWidth: 30, halign: "center", fontStyle: "bold" },
                3: { cellWidth: 40, halign: "right" },
              }
            : {
                0: { cellWidth: 12, halign: "center" },
                1: { cellWidth: 120, halign: "left" },
                2: { cellWidth: 30, halign: "center", fontStyle: "bold" },
              },
          margin: { left: marginLeft, right: marginLeft, top: 26 },
        });
      }

      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        if (i > 1) addLogo(doc);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80);
        doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 7, { align: "center" });
      }

      doc.save(encontradosEnBajaFisicamente ? "Encontrados_En_Baja_Fisicamente_Por_Rubro.pdf" : encontradosFisicamente ? "Encontrados_Fisicamente_Por_Rubro.pdf" : revaluo1355 ? "Revaluo_1355_Por_Rubro.pdf" : revaluo2553 ? "Revaluo_2553_Por_Rubro.pdf" : todoRevaluo ? "Todo_Revaluo_Por_Rubro.pdf" : recalcular && obsoleto ? "Recalcular_Obsoleto_Por_Rubro.pdf" : obsoleto ? "Obsoleto_Por_Rubro.pdf" : estabanEnBaja ? "Activos_Que_Estaban_En_Baja_Por_Rubro.pdf" : enAlta ? "Encontrado_Baja_Si_Son_Activos_Por_Rubro.pdf" : soloActivos ? "Encontrado_Baja_Si_Son_Activos_Por_Rubro.pdf" : soloNoActivos ? "Encontrados_Baja_No_Son_Activos_Por_Rubro.pdf" : "Encontrados_Por_Rubro.pdf");
      toast({ title: "Reporte generado", description: `Se exportaron ${allActivos.length} activos en ${rubrosOrdenados.length} rubros.` });
    } catch (err) {
      console.error("Error generando Encontrados por Rubro", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${formatError(err)}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  return { generate, isGenerating };
};
