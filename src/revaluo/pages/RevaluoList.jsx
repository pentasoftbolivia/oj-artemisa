import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DataPagination from "@/components/ui/data-pagination";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { RefreshCw, Scale, FileDown, Loader2, Image as ImageIcon, Dices, FileText } from "lucide-react";
import { useRevaluoData } from "../hooks/useRevaluoData";
import RevaluoFilters from "../components/RevaluoFilters";
import RevaluoTable from "../components/RevaluoTable";
import RevaluoEditModal from "../components/RevaluoEditModal";
import { getCachedCatalog } from "@/lib/catalogCache";
import { useUserDisplayNames } from "@/hooks/useUserDisplayNames";
import { useToast } from "@/hooks/use-toast";
import { normalizeCi, normalizeCiLoose, getCiPrefix } from "@/inventario/constants/inventarioConstants";
import { InventarioImagesModal } from "@/inventario/components/InventarioModals";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { fetchActivoImages, fetchAllPhotoCounts, updateActivoFields } from "@/inventario/services/inventarioService";
import { generateRevaluoReportSimple, generateRevaluoFaltantesReport, generateRevaluoLotesPDFReport } from "../services/revaluoReport";

const RANGOS_EXCEL_SIN_FOTOS = [
  { from: 1, to: 650 },
  { from: 651, to: 1300 },
  { from: 1301, to: 1950 },
  { from: 1951, to: 2600 },
];

// Rango de precios (Bs) para cotizaciones aleatorias según rubro/tipo rubro
const RANGO_PRECIO_POR_RUBRO = [
  [/COMPUTACION/, [1500, 12000]],
  [/OFICINA/, [300, 6000]],
  [/COMUNICACION/, [500, 9000]],
  [/EDUCACIONAL/, [400, 8000]],
  [/TRANSPORTE|TRACCION|ELEVACION/, [15000, 120000]],
  [/MAQUINARIA/, [3000, 50000]],
];
const RANGO_PRECIO_DEFECTO = [200, 15000];

// Respaldos (fuentes) de donde se obtiene cada precio de cotización
const PROVEEDORES_RESPALDO = [
  "TECNO MUNDO",
  "COMPUCENTER",
  "OFIMARKET",
  "ELECTRO HOGAR",
  "MULTIOFERTAS",
  "DISTRIBUIDORA ANDINA",
  "IMPORTADORA SUCRE",
  "CENTER OFFICE",
  "MUEBLERÍA EL ROBLE",
  "COMERCIAL LOS ANDES",
];

const normRubroTxt = (s) =>
  String(s || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Solo las filas que tienen dato en la columna Conservación
const tieneConservacion = (a) =>
  String(a.estadoconservacion ?? a.estadoConservacion ?? "").trim() !== "";

const INITIAL_FILTERS = {
  codigoActivo: "",
  estadoConservacion: "TODOS",
  estado: "TODOS",
  ubicacion: "",
  carnet: "",
  rubro: "TODOS",
  tipoRubro: "TODOS",
  fotos: "TODOS",
};

const FOTOS_LABELS = {
  SIN_FOTOS: "Sin fotos",
  UNA_FOTO_O_MAS: "1 foto o más",
};

const RevaluoList = () => {
  const { data, isLoading, error, fetchRevaluo } = useRevaluoData();
  const { getDisplayName } = useUserDisplayNames();
  const { toast } = useToast();

  const [draftFilters, setDraftFilters] = useState(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(INITIAL_FILTERS);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [rubros, setRubros] = useState([]);
  const [tipoRubros, setTipoRubros] = useState([]);
  const [ambientes, setAmbientes] = useState([]);
  const [responsables, setResponsables] = useState([]);
  const [ciudades, setCiudades] = useState([]);
  const [inmuebles, setInmuebles] = useState([]);
  const [niveles, setNiveles] = useState([]);

  const [editActivo, setEditActivo] = useState(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const [selectedActivoImages, setSelectedActivoImages] = useState(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imageFiles, setImageFiles] = useState([]);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [isGeneratingSimpleReport, setIsGeneratingSimpleReport] = useState(false);

  // Factores por defecto (B=Bueno, R=Regular, M=Malo, Ba=Baja) cuando la fila está vacía
  const [factores] = useState({
    frB: "1", frR: "1", frM: "1", frBa: "1",
    faB: "1", faR: "1", faM: "1", faBa: "1",
  });
  // Planilla editable por fila (solo en pantalla): cotizaciones y N° cotización
  const [worksheet, setWorksheet] = useState({});

  const handleWorksheetChange = useCallback((rowKey, field, value) => {
    setWorksheet((prev) => ({ ...prev, [rowKey]: { ...(prev[rowKey] || {}), [field]: value } }));
  }, []);

  useEffect(() => {
    fetchRevaluo();
  }, [fetchRevaluo]);

  useEffect(() => {
    const loadCatalogs = async () => {
      try {
        const [r, tr, amb, resp, ciu, inm, niv] = await Promise.all([
          getCachedCatalog("act_rubro"),
          getCachedCatalog("act_tiporubro"),
          getCachedCatalog("act_ambiente"),
          getCachedCatalog("act_responsable"),
          getCachedCatalog("act_ciudad"),
          getCachedCatalog("act_inmueble"),
          getCachedCatalog("act_nivel"),
        ]);
        setRubros(r || []);
        setTipoRubros(tr || []);
        setAmbientes(amb || []);
        setResponsables(resp || []);
        setCiudades(ciu || []);
        setInmuebles(inm || []);
        setNiveles(niv || []);
      } catch (e) {
        console.error("Error cargando catálogos revalúo:", e);
      }
    };
    loadCatalogs();
  }, []);

  const rubroDescMap = useMemo(() => {
    const map = {};
    (rubros || []).forEach((r) => {
      map[r.codigorubroact] = r.descripcionrubroact;
      map[String(r.codigorubroact)] = r.descripcionrubroact;
    });
    return map;
  }, [rubros]);

  const rubroFromTipo = useMemo(() => {
    const map = {};
    (tipoRubros || []).forEach((t) => {
      map[t.tiporubroact] = rubroDescMap[t.codigorubroact];
      map[String(t.tiporubroact)] = rubroDescMap[t.codigorubroact];
    });
    return map;
  }, [tipoRubros, rubroDescMap]);

  const tipoRubroDescMap = useMemo(() => {
    const map = {};
    (tipoRubros || []).forEach((t) => {
      map[t.tiporubroact] = t.descripciontiporubroact;
      map[String(t.tiporubroact)] = t.descripciontiporubroact;
    });
    return map;
  }, [tipoRubros]);

  const rubroOptions = useMemo(() => {
    const uniq = [...new Set((rubros || []).map((r) => r.descripcionrubroact).filter(Boolean))];
    return uniq.sort((a, b) => a.localeCompare(b)).map((v) => ({ value: v, label: v }));
  }, [rubros]);

  const tipoRubroOptions = useMemo(() => {
    return (tipoRubros || [])
      .map((t) => ({ value: String(t.tiporubroact), label: `${t.tiporubroact} - ${t.descripciontiporubroact}` }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [tipoRubros]);

  const rubroCodigoMap = useMemo(() => {
    const map = {};
    (rubros || []).forEach((r) => {
      map[r.descripcionrubroact] = r.codigorubroact;
      map[String(r.descripcionrubroact)] = r.codigorubroact;
    });
    return map;
  }, [rubros]);

  const tipoRubroOptionsFiltered = useMemo(() => {
    if (!draftFilters.rubro || draftFilters.rubro === "TODOS") return tipoRubroOptions;
    const cod = rubroCodigoMap[draftFilters.rubro];
    if (cod == null) return tipoRubroOptions;
    const codStr = String(cod);
    const filtered = (tipoRubros || []).filter((t) => String(t.codigorubroact) === codStr);
    return filtered
      .map((t) => ({ value: String(t.tiporubroact), label: `${t.tiporubroact} - ${t.descripciontiporubroact}` }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [tipoRubroOptions, tipoRubros, draftFilters.rubro, rubroCodigoMap]);

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
      const inmueble = nivel ? inmuebleMap[String(nivel.codigoinmueble ?? "").trim()] : null;
      const ciudad = inmueble ? ciudadMap[String(inmueble.codigociudad ?? "").trim()] : null;
      ambMap[code] = [ciudad?.descripcion, inmueble?.inmueble, nivel?.nivel, a.ambiente].map((s) => (s || "").trim()).filter(Boolean).join(" / ") || "—";
    });
    return ambMap;
  }, [ambientes, niveles, inmuebles, ciudades]);

  const getAmbienteName = useCallback(
    (code) => {
      const c = String(code ?? "").trim();
      return ubicacionJerarquiaMap[c] || c || "—";
    },
    [ubicacionJerarquiaMap]
  );

  const ubicacionDetalleMap = useMemo(() => {
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
    const detMap = {};
    (ambientes || []).forEach((a) => {
      const code = String(a.codigoambiente ?? "").trim();
      if (!code) return;
      const nivel = nivelMap[String(a.codigonivel ?? "").trim()];
      const inmueble = nivel ? inmuebleMap[String(nivel.codigoinmueble ?? "").trim()] : null;
      const ciudad = inmueble ? ciudadMap[String(inmueble.codigociudad ?? "").trim()] : null;
      detMap[code] = {
        ciudad: String(ciudad?.descripcion ?? "").trim(),
        inmueble: String(inmueble?.inmueble ?? "").trim(),
        nivel: String(nivel?.nivel ?? "").trim(),
        ambiente: String(a.ambiente ?? "").trim(),
      };
    });
    return detMap;
  }, [ambientes, niveles, inmuebles, ciudades]);

  const getUbicacionDetalle = useCallback(
    (code) => ubicacionDetalleMap[String(code ?? "").trim()] || null,
    [ubicacionDetalleMap]
  );

  const responsableMap = useMemo(() => {
    const map = {};
    (responsables || []).forEach((r) => {
      const raw = String(r.cirun ?? "").trim();
      map[raw] = r;
      const norm = normalizeCi(r.cirun);
      if (norm !== raw) map[norm] = r;
      const loose = normalizeCiLoose(r.cirun);
      if (loose !== raw && loose !== norm) map[loose] = r;
      const prefix = getCiPrefix(raw);
      if (prefix && prefix !== raw && prefix !== norm && prefix !== loose) map[prefix] = r;
    });
    return map;
  }, [responsables]);

  const getResponsableName = useCallback(
    (cirun) => {
      const rawCi = String(cirun ?? "").trim();
      if (!rawCi) return "—";
      const normCi = normalizeCi(rawCi);
      const looseCi = normalizeCiLoose(rawCi);
      const prefixCi = getCiPrefix(rawCi);
      const resp = responsableMap[normCi] || responsableMap[looseCi] || responsableMap[prefixCi] || responsableMap[rawCi];
      return resp ? [resp.nombre1, resp.nombre2, resp.paterno, resp.materno].map((s) => (s || "").trim()).filter(Boolean).join(" ") || resp.cirun : rawCi || "—";
    },
    [responsableMap]
  );

  const handleDraftFilterChange = (key, value) => {
    setDraftFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "rubro" && value !== "TODOS" && prev.tipoRubro !== "TODOS") {
        const cod = rubroCodigoMap[value];
        const tipo = (tipoRubros || []).find((t) => String(t.tiporubroact) === String(prev.tipoRubro));
        if (tipo && cod != null && String(tipo.codigorubroact) !== String(cod)) {
          next.tipoRubro = "TODOS";
        }
      }
      return next;
    });
  };

  useEffect(() => {
    if (draftFilters.rubro !== "TODOS" && draftFilters.tipoRubro !== "TODOS") {
      const cod = rubroCodigoMap[draftFilters.rubro];
      const tipo = (tipoRubros || []).find((t) => String(t.tiporubroact) === String(draftFilters.tipoRubro));
      if (tipo && cod != null && String(tipo.codigorubroact) !== String(cod)) {
        setDraftFilters((prev) => ({ ...prev, tipoRubro: "TODOS" }));
      }
    }
  }, [draftFilters.rubro, draftFilters.tipoRubro, rubroCodigoMap, tipoRubros]);

  const handleSearch = () => {
    setAppliedFilters(draftFilters);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setDraftFilters(INITIAL_FILTERS);
    setAppliedFilters(INITIAL_FILTERS);
    setCurrentPage(1);
  };

  // Años asignados por tipo de bien según rubro (mapeo por palabra clave)
  // Las etiquetas con detalle por estado se definen más abajo (ANOS_POR_RUBRO_LABELS)
  // Vida útil de Equipo de Oficina y Muebles según estado de conservación
  const OFICINA_ANOS_POR_ESTADO = [
    { estado: "Nuevo", anos: 10 },
    { estado: "Bueno", anos: 6 },
    { estado: "Regular", anos: 3 },
    { estado: "Malo", anos: 0 },
  ];
  // Vida útil de Equipo de Comunicación y Equipo Educacional y Recreativo según estado
  const COM_EDU_ANOS_POR_ESTADO = [
    { estado: "Nuevo", anos: 8 },
    { estado: "Bueno", anos: 6 },
    { estado: "Regular", anos: 4 },
    { estado: "Malo", anos: 0 },
  ];
  const COM_EDU_ANOS_MAP = { NUEVO: 8, BUENO: 6, REGULAR: 4, MALO: 0 };
  // Vida útil de Equipo de Computación según estado de conservación
  const COMPU_ANOS_POR_ESTADO = [
    { estado: "Nuevo", anos: 4 },
    { estado: "Bueno", anos: 3 },
    { estado: "Regular", anos: 2 },
    { estado: "Malo", anos: 0 },
  ];
  const COMPU_ANOS_MAP = { NUEVO: 4, BUENO: 3, REGULAR: 2, MALO: 0 };
  // Vida útil de Equipo de transporte/tracción/elevación y Otras maquinarias según estado
  const TRANS_MAQ_ANOS_POR_ESTADO = [
    { estado: "Nuevo", anos: 5 },
    { estado: "Bueno", anos: 3 },
    { estado: "Regular", anos: 2 },
    { estado: "Malo", anos: 0 },
  ];
  const TRANS_MAQ_ANOS_MAP = { NUEVO: 5, BUENO: 3, REGULAR: 2, MALO: 0 };
  const OFICINA_ANOS_MAP = { NUEVO: 10, BUENO: 6, REGULAR: 3, MALO: 0 };
  // Resumen por rubro para mostrar los valores en la interfaz (valor base = estado Nuevo)
  const ANOS_POR_RUBRO_LABELS = [
    { label: "Equipo de Comunicaciones", anos: 8, detalle: COM_EDU_ANOS_POR_ESTADO },
    { label: "Equipo de oficina y muebles", anos: 10, detalle: OFICINA_ANOS_POR_ESTADO },
    { label: "Equipo educacional y recreativo", anos: 8, detalle: COM_EDU_ANOS_POR_ESTADO },
    { label: "Equipo de computación", anos: 4, detalle: COMPU_ANOS_POR_ESTADO },
    { label: "Equipo de transporte, tracción y elevación", anos: 5, detalle: TRANS_MAQ_ANOS_POR_ESTADO },
    { label: "Otra maquinaria y equipo", anos: 8, detalle: TRANS_MAQ_ANOS_POR_ESTADO },
  ];
  const ANOS_POR_RUBRO = [
    [/COMUNICACION/, 4],
    [/OFICINA/, 10],
    [/EDUCACIONAL/, 8],
    [/COMPUTACION/, 4],
    [/TRANSPORTE|TRACCION|ELEVACION/, 5],
    [/OTRA MAQUINARIA/, 8],
    [/MAQUINARIA/, 5],
  ];
  const normRubro = (s) =>
    String(s || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Años x tipo: valor FIJO por rubro (sin estado de conservación)
  const ANOS_TIPO_POR_RUBRO = [
    [/COMUNICACION/, 8],
    [/OFICINA/, 10],
    [/EDUCACIONAL/, 8],
    [/COMPUTACION/, 4],
    [/TRANSPORTE|TRACCION|ELEVACION/, 5],
    [/OTRA MAQUINARIA/, 8],
    [/MAQUINARIA/, 5],
  ];
  const resolveVidaTipo = (rubroDesc) => {
    const match = ANOS_TIPO_POR_RUBRO.find(([re]) => re.test(normRubro(rubroDesc)));
    return match ? match[1] : null;
  };

  // Años asignados por tipo de bien = mapeo por rubro, con respaldo en vida útil de BD
  const vidaUtilPorRubro = useMemo(() => {
    const map = {};
    (rubros || []).forEach((r) => {
      if (!r.descripcionrubroact) return;
      const key = String(r.descripcionrubroact).trim();
      const n = normRubro(key);
      const match = ANOS_POR_RUBRO.find(([re]) => re.test(n));
      if (match) {
        map[key] = match[1];
      } else if (r.vidautil != null && String(r.vidautil).trim() !== "") {
        map[key] = Number(r.vidautil);
      }
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rubros]);

  // Años Asig.: vida útil según rubro y estado (cuadros); Años x tipo: fijo por rubro
  const resolveVidaUtil = (rubroDesc, estadoCons, baseMap) => {
    const n = normRubro(rubroDesc);
    const key = String(estadoCons || "").trim().toUpperCase();
    if (n.includes("OFICINA")) {
      const v = OFICINA_ANOS_MAP[key];
      return v !== undefined ? v : 10;
    }
    if (n.includes("COMUNICACION")) {
      const v = COM_EDU_ANOS_MAP[key];
      return v !== undefined ? v : 8;
    }
    if (n.includes("EDUCACIONAL")) {
      const v = COM_EDU_ANOS_MAP[key];
      return v !== undefined ? v : 8;
    }
    if (n.includes("COMPUTACION")) {
      const v = COMPU_ANOS_MAP[key];
      return v !== undefined ? v : 4;
    }
    if (n.includes("TRANSPORTE") || n.includes("TRACCION") || n.includes("ELEVACION") || n.includes("MAQUINARIA")) {
      const v = TRANS_MAQ_ANOS_MAP[key];
      return v !== undefined ? v : 5;
    }
    return baseMap[String(rubroDesc || "").trim()] ?? null;
  };

  const enrichedAll = useMemo(() => {
    const mapped = (data || []).map((a) => {
      const codigoActivo = a.codigoactivo ?? a.codigoActivo;
      const codigoActivoInterno = a.codigoactivointerno ?? a.codigoActivoInterno;
      const tipoRubroAct = a.tiporubroact ?? a.tipoRubroAct;
      const rubroDesc = rubroFromTipo[tipoRubroAct] ?? rubroFromTipo[String(tipoRubroAct)] ?? "—";
      const tipoDesc = tipoRubroDescMap[tipoRubroAct] ?? tipoRubroDescMap[String(tipoRubroAct)] ?? String(tipoRubroAct || "—");
      const ambCode = String(a.codigoambiente ?? a.codigoAmbiente ?? "").trim();
      const ubicacion = getAmbienteName(ambCode);
      const ubicDet = getUbicacionDetalle(ambCode);
      const ciRaw = String(a.cirun ?? "").trim();
      const responsableName = getResponsableName(ciRaw);
      const inventariador = getDisplayName(a.usuarioinventario) || a.usuarioinventario || "—";
      const valorRaw = a.valoractual ?? a.valorActual ?? null;
      const valorFmt = valorRaw != null && String(valorRaw).trim() !== "" ? `Bs ${Number(valorRaw).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";
      const estadoCons = String(a.estadoconservacion ?? a.estadoConservacion ?? "").trim().toUpperCase() || "—";
      return {
        ...a,
        codigoActivo,
        codigoActivoInterno,
        tipoRubroAct,
        codigoAmbiente: ambCode,
        cirun: ciRaw,
        descripcionActivo: a.descripcionactivo ?? a.descripcionActivo,
        _codigoActivo: codigoActivo != null ? `OJ-02-${codigoActivo}` : "—",
        _rubro: rubroDesc,
        _tipoRubro: tipoDesc,
        _ubicacion: ubicacion,
        _ciudad: ubicDet?.ciudad || "",
        _inmueble: ubicDet?.inmueble || "",
        _nivel: ubicDet?.nivel || "",
        _ambiente: ubicDet?.ambiente || "",
        _responsableName: responsableName,
        _carnet: ciRaw || "—",
        _inventariador: inventariador,
        _estadoConservacion: estadoCons,
        _valorActual: valorFmt,
        _valorRaw: valorRaw,
        _vidaUtil: resolveVidaUtil(rubroDesc, estadoCons, vidaUtilPorRubro),
        _vidaTipo: resolveVidaTipo(rubroDesc),
        _ambienteKey: ambCode,
        marcaMaterial: a.marcamaterial ?? a.marcaMaterial,
        modelo: a.modelo,
        serie: a.serie,
        observaciones: a.observaciones,
        estadoconservacion: a.estadoconservacion,
      };
    });
    return mapped.sort((a, b) => String(a._ubicacion || "").localeCompare(String(b._ubicacion || ""), "es", { sensitivity: "base" }));
  }, [data, rubroFromTipo, tipoRubroDescMap, getAmbienteName, getUbicacionDetalle, getResponsableName, getDisplayName, vidaUtilPorRubro]);

  const filteredBase = useMemo(() => {
    const codigo = String(appliedFilters.codigoActivo || "").trim().toLowerCase();
    const estadoCons = String(appliedFilters.estadoConservacion || "TODOS").trim().toUpperCase();
    const estadoAltaBaja = String(appliedFilters.estado || "TODOS").trim().toUpperCase();
    const ubicacion = String(appliedFilters.ubicacion || "").trim().toLowerCase();
    const carnet = String(appliedFilters.carnet || "").trim().toLowerCase();
    const rubro = String(appliedFilters.rubro || "TODOS").trim();
    const tipoRubro = String(appliedFilters.tipoRubro || "TODOS").trim();

    const mapEstadoAltaBaja = (v) => {
      const s = String(v ?? "").trim().toUpperCase();
      if (s === "1" || s === "TRUE" || s === "ALTA") return "ALTA";
      if (s === "0" || s === "FALSE" || s === "BAJA") return "BAJA";
      return s || "—";
    };

    return enrichedAll.filter((a) => {
      if (codigo) {
        const rawCodigo = String(a.codigoActivo ?? "").toLowerCase();
        const formatted = String(a._codigoActivo || "").toLowerCase();
        if (!rawCodigo.includes(codigo.replace("oj-02-", "").replace("-", "")) && !formatted.includes(codigo) && !rawCodigo.includes(codigo)) return false;
      }
      if (estadoCons && estadoCons !== "TODOS") {
        if (String(a._estadoConservacion || "").toUpperCase() !== estadoCons) return false;
      }
      if (estadoAltaBaja && estadoAltaBaja !== "TODOS") {
        const aEstado = mapEstadoAltaBaja(a.estado ?? a.estadoActivo);
        if (aEstado !== estadoAltaBaja) return false;
      }
      if (ubicacion && !String(a._ubicacion || "").toLowerCase().includes(ubicacion)) return false;
      if (carnet && !String(a._carnet || "").toLowerCase().includes(carnet)) return false;
      if (rubro && rubro !== "TODOS" && String(a._rubro || "").trim().toLowerCase() !== String(rubro).trim().toLowerCase()) return false;
      if (tipoRubro && tipoRubro !== "TODOS" && String(a.tipoRubroAct) !== tipoRubro) return false;
      return true;
    });
  }, [enrichedAll, appliedFilters]);

  const fotosFilter = String(appliedFilters.fotos || "TODOS").trim().toUpperCase();

  const [photoCounts, setPhotoCounts] = useState({});
  const [isLoadingPhotoCounts, setIsLoadingPhotoCounts] = useState(false);
  const photoCountsRef = useRef({});
  useEffect(() => {
    photoCountsRef.current = photoCounts;
  }, [photoCounts]);

  // Conteo de fotos en 1 sola pasada (lista completa del bucket) cuando el filtro está activo
  useEffect(() => {
    if (fotosFilter === "TODOS" || filteredBase.length === 0) {
      setIsLoadingPhotoCounts(false);
      return;
    }
    let cancelled = false;
    setIsLoadingPhotoCounts(true);
    (async () => {
      try {
        const counts = await fetchAllPhotoCounts();
        if (cancelled) return;
        const merged = { ...photoCountsRef.current, ...counts };
        photoCountsRef.current = merged;
        setPhotoCounts(merged);
      } catch (e) {
        console.error("Error contando fotos:", e);
      } finally {
        if (!cancelled) setIsLoadingPhotoCounts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filteredBase, fotosFilter]);

  const matchFotosCount = useCallback(
    (count) => {
      switch (fotosFilter) {
        case "SIN_FOTOS":
          return count === 0;
        case "UNA_FOTO_O_MAS":
          return count >= 1;
        default:
          return true;
      }
    },
    [fotosFilter]
  );

  const filteredEnriched = useMemo(() => {
    if (fotosFilter === "TODOS") return filteredBase;
    const cache = photoCountsRef.current;
    return filteredBase.filter((a) => {
      const key = String(a.codigoActivo);
      return matchFotosCount(cache[key] || 0);
    });
  }, [filteredBase, fotosFilter, matchFotosCount, photoCounts]);

  const totalPages = Math.max(1, Math.ceil(filteredEnriched.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedData = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredEnriched.slice(start, start + pageSize);
  }, [filteredEnriched, safeCurrentPage, pageSize]);

  useEffect(() => {
    let cancelled = false;
    const fetchCounts = async () => {
      if (paginatedData.length === 0) return;
      const entries = await Promise.all(
        paginatedData.map(async (a) => {
          const key = String(a.codigoActivo);
          try {
            const files = await fetchActivoImages(a.codigoActivo);
            return [key, files.length];
          } catch {
            return [key, 0];
          }
        })
      );
      if (!cancelled) {
        setPhotoCounts((prev) => {
          const next = { ...prev };
          let changed = false;
          entries.forEach(([k, v]) => {
            if (next[k] !== v) {
              next[k] = v;
              changed = true;
            }
          });
          return changed ? next : prev;
        });
      }
    };
    fetchCounts();
    return () => {
      cancelled = true;
    };
  }, [paginatedData]);

  const hasActiveFilters = Boolean(
    appliedFilters.codigoActivo ||
    (appliedFilters.estadoConservacion && appliedFilters.estadoConservacion !== "TODOS") ||
    (appliedFilters.estado && appliedFilters.estado !== "TODOS") ||
    appliedFilters.ubicacion ||
    appliedFilters.carnet ||
    (appliedFilters.rubro && appliedFilters.rubro !== "TODOS") ||
    (appliedFilters.tipoRubro && appliedFilters.tipoRubro !== "TODOS") ||
    (appliedFilters.fotos && appliedFilters.fotos !== "TODOS")
  );

  const handleEdit = useCallback(
    (activo) => {
      const rubroDesc = rubroFromTipo[activo.tipoRubroAct] || "";
      const rawEstado = String(activo.estado ?? activo.estadoActivo ?? "1").trim().toUpperCase();
      const estadoNorm = rawEstado === "0" || rawEstado === "BAJA" || rawEstado === "FALSE" ? "0" : "1";
      setEditActivo(activo);
      setEditForm({
        codigoActivo: activo.codigoActivo != null ? String(activo.codigoActivo) : "",
        tipoRubroAct: activo.tipoRubroAct != null ? String(activo.tipoRubroAct) : "",
        rubro: rubroDesc,
        descripcionActivo: (activo.descripcionActivo || "").trim(),
        codigoAmbiente: String(activo.codigoAmbiente ?? "").trim(),
        cirun: String(activo.cirun || "").trim(),
        usuarioinventario: String(activo.usuarioinventario || "").trim(),
        estadoConservacion: String(activo._estadoConservacion || activo.estadoconservacion || "REGULAR").trim().toUpperCase() || "REGULAR",
        estado: estadoNorm,
        valorActual: activo._valorRaw != null ? String(activo._valorRaw) : "",
        observaciones: (activo.observaciones || "").trim(),
      });
      setIsEditOpen(true);
    },
    [rubroFromTipo]
  );

  const handleEditChange = (e) => {
    const { id, value } = e.target;
    setEditForm((p) => ({ ...p, [id]: value }));
  };

  const handleEditSelectChange = (field, value) => {
    setEditForm((p) => ({ ...p, [field]: value }));
    if (field === "tipoRubroAct") {
      const rubroDesc = rubroFromTipo[value] || "";
      setEditForm((p) => ({ ...p, rubro: rubroDesc }));
    }
  };

  const handleEditSave = async () => {
    if (!editActivo) return;
    setIsSaving(true);
    try {
      const fieldsToUpdate = {};
      if (editForm.tipoRubroAct) fieldsToUpdate.tiporubroact = editForm.tipoRubroAct;
      fieldsToUpdate.descripcionactivo = editForm.descripcionActivo;
      if (editForm.codigoAmbiente) fieldsToUpdate.codigoambiente = editForm.codigoAmbiente;
      fieldsToUpdate.cirun = editForm.cirun || null;
      if (editForm.usuarioinventario) fieldsToUpdate.usuarioinventario = editForm.usuarioinventario;
      if (editForm.estadoConservacion) fieldsToUpdate.estadoconservacion = editForm.estadoConservacion;
      if (editForm.estado != null && editForm.estado !== "") fieldsToUpdate.estado = editForm.estado === "1" ? 1 : 0;
      if (editForm.valorActual !== "" && editForm.valorActual != null) {
        const num = Number(String(editForm.valorActual).replace(",", "."));
        fieldsToUpdate.valoractual = isNaN(num) ? null : num;
      } else {
        fieldsToUpdate.valoractual = null;
      }
      fieldsToUpdate.observaciones = editForm.observaciones || null;

      await updateActivoFields(editActivo.codigoActivoInterno, fieldsToUpdate);
      toast({ title: "Éxito", description: "Activo actualizado correctamente." });
      setIsEditOpen(false);
      setEditActivo(null);
      await fetchRevaluo();
    } catch (err) {
      toast({ title: "Error", description: `Error al actualizar: ${err.message || ""}`, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenImages = async (activo) => {
    setSelectedActivoImages(activo);
    setIsLoadingImages(true);
    setIsImageModalOpen(true);
    try {
      const files = await fetchActivoImages(activo.codigoActivo);
      setImageFiles(files);
    } catch (e) {
      console.error("Error al cargar imágenes:", e);
      setImageFiles([]);
    } finally {
      setIsLoadingImages(false);
    }
  };

  const handleGenerateSimpleReport = async () => {
    if (filteredEnriched.length === 0) {
      toast({ title: "Sin datos", description: "No hay activos para generar el reporte con los filtros actuales.", variant: "destructive" });
      return;
    }
    if (filteredEnriched.length > 100) {
      const confirmed = window.confirm(
        `Se generará un Excel con ${filteredEnriched.length} activos incluyendo las direcciones de las fotos. Esto puede tardar un momento. ¿Desea continuar?`
      );
      if (!confirmed) return;
    }
    setIsGeneratingSimpleReport(true);
    toast({ title: "Generando Excel", description: `Preparando ${filteredEnriched.length} activos con todos los datos y direcciones de fotos...` });
    try {
      const parts = [];
      if (appliedFilters.codigoActivo) parts.push(`Código: ${appliedFilters.codigoActivo}`);
      if (appliedFilters.estadoConservacion && appliedFilters.estadoConservacion !== "TODOS") parts.push(`Est. Cons.: ${appliedFilters.estadoConservacion}`);
      if (appliedFilters.estado && appliedFilters.estado !== "TODOS") parts.push(`Estado: ${appliedFilters.estado}`);
      if (appliedFilters.ubicacion) parts.push(`Ubicación: ${appliedFilters.ubicacion}`);
      if (appliedFilters.carnet) parts.push(`Carnet: ${appliedFilters.carnet}`);
      if (appliedFilters.rubro && appliedFilters.rubro !== "TODOS") parts.push(`Rubro: ${appliedFilters.rubro}`);
      if (appliedFilters.tipoRubro && appliedFilters.tipoRubro !== "TODOS") parts.push(`Tipo Rubro: ${appliedFilters.tipoRubro}`);
      if (appliedFilters.fotos && appliedFilters.fotos !== "TODOS") parts.push(`Fotos: ${FOTOS_LABELS[appliedFilters.fotos] || appliedFilters.fotos}`);
      await generateRevaluoReportSimple({
        activos: filteredEnriched,
        filtrosResumen: parts.join(" | "),
        worksheet,
        photoCounts,
        onProgress: (current, total) => {
          if (current % 25 === 0 || current === total) {
            console.log(`Excel progreso ${current}/${total}`);
          }
        },
      });
      toast({ title: "Reporte generado", description: `Excel con ${filteredEnriched.length} activos, datos completos y direcciones de fotos descargado.` });
    } catch (err) {
      console.error("Error generando reporte simple:", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${err.message || ""}`, variant: "destructive" });
    } finally {
      setIsGeneratingSimpleReport(false);
    }
  };

  const [isRangeModalOpen, setIsRangeModalOpen] = useState(false);
  const [isDatosModalOpen, setIsDatosModalOpen] = useState(false);
  const [rangoList, setRangoList] = useState([]);
  const [rangoFiltros, setRangoFiltros] = useState("");
  const [generatingRangeIdx, setGeneratingRangeIdx] = useState(null);
  const [generatingRangePDFIdx, setGeneratingRangePDFIdx] = useState(null);

  const handleGenerateMissingReport = () => {
    if (filteredEnriched.length === 0) {
      toast({ title: "Sin datos", description: "No hay activos para generar el reporte con los filtros actuales.", variant: "destructive" });
      return;
    }
    const parts = [];
    if (appliedFilters.codigoActivo) parts.push(`Código: ${appliedFilters.codigoActivo}`);
    if (appliedFilters.estadoConservacion && appliedFilters.estadoConservacion !== "TODOS") parts.push(`Est. Cons.: ${appliedFilters.estadoConservacion}`);
    if (appliedFilters.estado && appliedFilters.estado !== "TODOS") parts.push(`Estado: ${appliedFilters.estado}`);
    if (appliedFilters.ubicacion) parts.push(`Ubicación: ${appliedFilters.ubicacion}`);
    if (appliedFilters.carnet) parts.push(`Carnet: ${appliedFilters.carnet}`);
    if (appliedFilters.rubro && appliedFilters.rubro !== "TODOS") parts.push(`Rubro: ${appliedFilters.rubro}`);
    if (appliedFilters.tipoRubro && appliedFilters.tipoRubro !== "TODOS") parts.push(`Tipo Rubro: ${appliedFilters.tipoRubro}`);
    if (appliedFilters.fotos && appliedFilters.fotos !== "TODOS") parts.push(`Fotos: ${FOTOS_LABELS[appliedFilters.fotos] || appliedFilters.fotos}`);
    setRangoList(filteredEnriched);
    setRangoFiltros(parts.join(" | "));
    setIsRangeModalOpen(true);
  };

  const rowKeyOfList = (a) =>
    String(a.codigoActivoInterno ?? a.codigoactivointerno ?? a.codigoActivo ?? a._codigoActivo ?? "");

  const resolveRangoPrecio = (a) => {
    const txt = normRubroTxt(`${a._rubro || ""} ${a._tipoRubro || ""}`);
    const match = RANGO_PRECIO_POR_RUBRO.find(([re]) => re.test(txt));
    return match ? match[1] : RANGO_PRECIO_DEFECTO;
  };

  const randomRespaldo = () => {
    const prov = PROVEEDORES_RESPALDO[Math.floor(Math.random() * PROVEEDORES_RESPALDO.length)];
    const num = Math.floor(Math.random() * 9000 + 1000);
    return `${prov} Nº ${num}`;
  };

  // Genera cotizaciones aleatorias (según tipo rubro) y su respaldo (N° cotización)
  // SOLO en las filas que tienen dato en la columna Conservación.
  const handleGenerateRandomData = () => {
    const rows = filteredEnriched.filter(tieneConservacion);
    if (rows.length === 0) {
      toast({ title: "Sin datos", description: "No hay filas con dato en Conservación en la lista actual.", variant: "destructive" });
      return;
    }
    setWorksheet((prev) => {
      const next = { ...prev };
      rows.forEach((a) => {
        const [min, max] = resolveRangoPrecio(a);
        const base = min + Math.random() * (max - min);
        const vary = () => Math.max(1, base * (0.9 + Math.random() * 0.2));
        next[rowKeyOfList(a)] = {
          c1: vary().toFixed(2),
          c2: vary().toFixed(2),
          c3: vary().toFixed(2),
          n1: randomRespaldo(),
          n2: randomRespaldo(),
          n3: randomRespaldo(),
        };
      });
      return next;
    });
    toast({ title: "Datos generados", description: `Cotizaciones y respaldos aleatorios para ${rows.length} filas con Conservación.` });
  };

  const [isGeneratingDatosReport, setIsGeneratingDatosReport] = useState(false);

  // Reporte en Excel de TODOS los activos de la lista que tienen dato en Conservación.
  const handleGenerateConservacionReport = async () => {
    const rows = filteredEnriched.filter(tieneConservacion);
    if (rows.length === 0) {
      toast({ title: "Sin datos", description: "No hay filas con dato en Conservación en la lista actual.", variant: "destructive" });
      return;
    }
    setIsGeneratingDatosReport(true);
    try {
      const parts = ["Con dato en Conservación"];
      if (appliedFilters.codigoActivo) parts.push(`Código: ${appliedFilters.codigoActivo}`);
      if (appliedFilters.estadoConservacion && appliedFilters.estadoConservacion !== "TODOS") parts.push(`Est. Cons.: ${appliedFilters.estadoConservacion}`);
      if (appliedFilters.estado && appliedFilters.estado !== "TODOS") parts.push(`Estado: ${appliedFilters.estado}`);
      if (appliedFilters.ubicacion) parts.push(`Ubicación: ${appliedFilters.ubicacion}`);
      if (appliedFilters.carnet) parts.push(`Carnet: ${appliedFilters.carnet}`);
      if (appliedFilters.rubro && appliedFilters.rubro !== "TODOS") parts.push(`Rubro: ${appliedFilters.rubro}`);
      if (appliedFilters.tipoRubro && appliedFilters.tipoRubro !== "TODOS") parts.push(`Tipo Rubro: ${appliedFilters.tipoRubro}`);
      if (appliedFilters.fotos && appliedFilters.fotos !== "TODOS") parts.push(`Fotos: ${FOTOS_LABELS[appliedFilters.fotos] || appliedFilters.fotos}`);
      await generateRevaluoFaltantesReport({
        activos: rows,
        filtrosResumen: parts.join(" | "),
        worksheet,
        filePrefix: "REVALUO_ReporteConservacion",
        tituloReporte: "ACTIVOS REVALUADOS",
      });
      toast({ title: "Reporte generado", description: `Excel con ${rows.length} activos con Conservación descargado.` });
    } catch (err) {
      console.error("Error generando reporte de conservación:", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${err.message || ""}`, variant: "destructive" });
    } finally {
      setIsGeneratingDatosReport(false);
    }
  };

  const handleGenerateRangeReport = async (rangeIdx) => {
    const rango = RANGOS_EXCEL_SIN_FOTOS[rangeIdx];
    if (!rango || rangoList.length === 0) return;
    const slice = rangoList.slice(rango.from - 1, rango.to);
    if (slice.length === 0) {
      toast({ title: "Sin datos", description: `No hay activos del ${rango.from} al ${rango.to}.`, variant: "destructive" });
      return;
    }
    const realTo = rango.from - 1 + slice.length;
    setGeneratingRangeIdx(rangeIdx);
    try {
      const resumen = rangoFiltros
        ? `${rangoFiltros} | Rango: del ${rango.from} al ${realTo}`
        : `Rango: del ${rango.from} al ${realTo}`;
      await generateRevaluoFaltantesReport({
        activos: slice,
        filtrosResumen: resumen,
        worksheet,
        filePrefix: `REVALUO_ExcelSinFotos_${rango.from}-${realTo}`,
        numeroInicial: rango.from,
      });
      toast({ title: "Reporte generado", description: `Excel con ${slice.length} activos (del ${rango.from} al ${realTo}) descargado.` });
    } catch (err) {
      console.error("Error generando reporte por rango:", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${err.message || ""}`, variant: "destructive" });
    } finally {
      setGeneratingRangeIdx(null);
    }
  };

  const handleGenerateRangePDFReport = async (rangeIdx) => {
    const rango = RANGOS_EXCEL_SIN_FOTOS[rangeIdx];
    if (!rango || rangoList.length === 0) return;
    const slice = rangoList.slice(rango.from - 1, rango.to);
    if (slice.length === 0) {
      toast({ title: "Sin datos", description: `No hay activos del ${rango.from} al ${rango.to}.`, variant: "destructive" });
      return;
    }
    if (slice.length > 200) {
      const confirmed = window.confirm(
        `Se generará un PDF con ${slice.length} activos incluyendo fotos. Esto puede tardar varios minutos. ¿Desea continuar?`
      );
      if (!confirmed) return;
    }
    const realTo = rango.from - 1 + slice.length;
    setGeneratingRangePDFIdx(rangeIdx);
    try {
      const resumen = rangoFiltros
        ? `${rangoFiltros} | Rango: del ${rango.from} al ${realTo}`
        : `Rango: del ${rango.from} al ${realTo}`;
      await generateRevaluoLotesPDFReport({
        activos: slice,
        filtrosResumen: resumen,
        worksheet,
        filePrefix: `REPORTE_LOTES_PDF_${rango.from}-${realTo}`,
        numeroInicial: rango.from,
        onProgress: (current, total) => {
          if (current % 50 === 0 || current === total) {
            console.log(`PDF lote progreso ${current}/${total}`);
          }
        },
      });
      toast({ title: "Reporte generado", description: `PDF con ${slice.length} activos (del ${rango.from} al ${realTo}) descargado.` });
    } catch (err) {
      console.error("Error generando PDF por rango:", err);
      toast({ title: "Error", description: `No se pudo generar el PDF: ${err.message || ""}`, variant: "destructive" });
    } finally {
      setGeneratingRangePDFIdx(null);
    }
  };

  if (isLoading && data.length === 0) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-600 text-white text-center p-4 rounded-lg">Error: {error}</div>
        <Button onClick={fetchRevaluo} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2 leading-tight">
            <Scale className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600 shrink-0" />
            REVALUO
          </h1>
          <p className="text-sm text-muted-foreground leading-tight">Listado de activos para Revalúo Ordenado por Ubicación</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button onClick={handleGenerateMissingReport} disabled={filteredEnriched.length === 0} className="bg-amber-600 hover:bg-amber-700 text-white w-full sm:w-auto min-h-11 sm:min-h-9 text-xs sm:text-sm">
            <FileDown className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">Reporte por Lotes</span>
          </Button>
          <Button onClick={() => setIsDatosModalOpen(true)} disabled={filteredEnriched.length === 0} className="bg-violet-600 hover:bg-violet-700 text-white w-full sm:w-auto min-h-11 sm:min-h-9 text-xs sm:text-sm">
            <Dices className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">Datos Aleatorios</span>
          </Button>
          <Button onClick={handleGenerateSimpleReport} disabled={isGeneratingSimpleReport || filteredEnriched.length === 0} className="bg-sky-600 hover:bg-sky-700 text-white w-full sm:w-auto min-h-11 sm:min-h-9 text-xs sm:text-sm">
            {isGeneratingSimpleReport ? <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" /> : <FileDown className="mr-2 h-4 w-4 shrink-0" />}
            <span className="truncate">{isGeneratingSimpleReport ? "Generando..." : `Excel (${filteredEnriched.length})`}</span>
          </Button>
        </div>
      </div>

      <RevaluoFilters
        filters={draftFilters}
        onFilterChange={handleDraftFilterChange}
        onClearFilters={clearFilters}
        onSearch={handleSearch}
        rubroOptions={rubroOptions}
        tipoRubroOptions={tipoRubroOptionsFiltered}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 items-stretch">
        <Card className="overflow-hidden order-1">
          <CardHeader className="p-3 sm:p-6 pb-2">
            <CardTitle className="text-sm sm:text-base leading-tight">Años asignados por tipo de bien</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="rounded-md border p-2 sm:p-3 bg-muted/30">
              <ul className="space-y-1 text-xs">
                {ANOS_POR_RUBRO_LABELS.map((r) => (
                  <li key={r.label} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground leading-tight">{r.label}</span>
                    <span className="font-mono font-semibold shrink-0">{r.anos} años</span>
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-muted-foreground mt-2 leading-tight">Valores fijos por rubro (columna Años x tipo).</p>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden order-3">
          <CardHeader className="p-3 sm:p-6 pb-2">
            <CardTitle className="text-sm sm:text-base leading-tight">Equipo de Computación</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="rounded-md border p-2 sm:p-3 bg-muted/30">
              <ul className="space-y-1 text-xs">
                {COMPU_ANOS_POR_ESTADO.map((r) => (
                  <li key={r.estado} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground leading-tight">{r.estado}</span>
                    <span className="font-mono font-semibold shrink-0">{r.anos} años</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden order-4">
          <CardHeader className="p-3 sm:p-6 pb-2">
            <CardTitle className="text-sm sm:text-base leading-tight">Equipo de transporte y Maquinaria</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="rounded-md border p-2 sm:p-3 bg-muted/30">
              <ul className="space-y-1 text-xs">
                {TRANS_MAQ_ANOS_POR_ESTADO.map((r) => (
                  <li key={r.estado} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground leading-tight">{r.estado}</span>
                    <span className="font-mono font-semibold shrink-0">{r.anos} años</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden order-5">
          <CardHeader className="p-3 sm:p-6 pb-2">
            <CardTitle className="text-sm sm:text-base leading-tight">Equipo de Oficina y Muebles</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="rounded-md border p-2 sm:p-3 bg-muted/30">
              <ul className="space-y-1 text-xs">
                {OFICINA_ANOS_POR_ESTADO.map((r) => (
                  <li key={r.estado} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground leading-tight">{r.estado}</span>
                    <span className="font-mono font-semibold shrink-0">{r.anos} años</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden order-2">
          <CardHeader className="p-3 sm:p-6 pb-2">
            <CardTitle className="text-sm sm:text-base leading-tight">Equipo de Comunicación y Educacional</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="rounded-md border p-2 sm:p-3 bg-muted/30">
              <ul className="space-y-1 text-xs">
                {COM_EDU_ANOS_POR_ESTADO.map((r) => (
                  <li key={r.estado} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground leading-tight">{r.estado}</span>
                    <span className="font-mono font-semibold shrink-0">{r.anos} años</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="p-3 sm:p-6">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm sm:text-base leading-tight">
            <span className="flex items-center gap-2">
              <Scale className="h-4 w-4 shrink-0" />
              Activos para Revalúo
            </span>
            <span className="text-xs sm:text-sm font-normal text-muted-foreground">
              {filteredEnriched.length} de {data.length} activos
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0">
          {fotosFilter !== "TODOS" && isLoadingPhotoCounts ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Contando fotos de los activos filtrados...
            </div>
          ) : (
            <>
              <RevaluoTable activos={paginatedData} hasActiveFilters={hasActiveFilters} onEdit={handleEdit} onOpenImages={handleOpenImages} photoCounts={photoCounts} worksheet={worksheet} onWorksheetChange={handleWorksheetChange} factores={factores} />
              {filteredEnriched.length > 0 && (
            <div className="mt-4">
              <DataPagination
                currentPage={safeCurrentPage}
                totalPages={totalPages}
                totalCount={filteredEnriched.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize);
                  setCurrentPage(1);
                }}
              />
            </div>
          )}
            </>
          )}
        </CardContent>
      </Card>

      <RevaluoEditModal
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
        tipoRubroOptions={tipoRubroOptions}
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

      <Dialog open={isDatosModalOpen} onOpenChange={setIsDatosModalOpen}>
        <DialogContent className="w-[94vw] sm:max-w-[440px] p-4 sm:p-6">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base sm:text-lg leading-tight">Datos Aleatorios</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm leading-tight">
              {filteredEnriched.length > 0
                ? "Genera cotizaciones (según tipo rubro) y su respaldo en N° Cotización solo en las filas con dato en Conservación. El reporte en Excel incluye todos los activos con Conservación."
                : "No hay activos en la lista con los filtros actuales."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Button
              onClick={handleGenerateRandomData}
              disabled={filteredEnriched.length === 0}
              className="bg-violet-600 hover:bg-violet-700 text-white w-full min-h-11 text-xs sm:text-sm"
            >
              <Dices className="mr-2 h-4 w-4 shrink-0" />
              Generar Datos
            </Button>
            <Button
              onClick={handleGenerateConservacionReport}
              disabled={filteredEnriched.length === 0 || isGeneratingDatosReport}
              className="bg-amber-600 hover:bg-amber-700 text-white w-full min-h-11 text-xs sm:text-sm"
            >
              {isGeneratingDatosReport ? <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" /> : <FileDown className="mr-2 h-4 w-4 shrink-0" />}
              {isGeneratingDatosReport ? "Generando..." : "Generar reporte"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isRangeModalOpen} onOpenChange={setIsRangeModalOpen}>
        <DialogContent className="w-[94vw] sm:max-w-[440px] p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base sm:text-lg leading-tight">Reporte por Lotes</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm leading-tight">
              {rangoList.length > 0
                ? `Se encontraron ${rangoList.length} activos en la lista. Elija el rango y el formato a descargar.`
                : "No hay activos en la lista con los filtros actuales."}
            </DialogDescription>
          </DialogHeader>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground pt-1">Excel</div>
          <div className="grid gap-2 py-1">
            {RANGOS_EXCEL_SIN_FOTOS.map((rango, idx) => {
              const count = Math.max(0, Math.min(rango.to, rangoList.length) - rango.from + 1);
              const isGenerating = generatingRangeIdx === idx;
              return (
                <Button
                  key={`excel-${rango.from}-${rango.to}`}
                  onClick={() => handleGenerateRangeReport(idx)}
                  disabled={count === 0 || isGenerating || generatingRangeIdx !== null || generatingRangePDFIdx !== null}
                  className="bg-amber-600 hover:bg-amber-700 text-white w-full min-h-11 text-xs sm:text-sm justify-between"
                >
                  <span className="flex items-center gap-2">
                    {isGenerating ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <FileDown className="h-4 w-4 shrink-0" />}
                    {isGenerating ? "Generando..." : `Del ${rango.from} al ${rango.to}`}
                  </span>
                  <span className="font-mono text-[11px] opacity-90">({count})</span>
                </Button>
              );
            })}
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground pt-1">PDF con fotografía</div>
          <div className="grid gap-2 py-1">
            {RANGOS_EXCEL_SIN_FOTOS.map((rango, idx) => {
              const count = Math.max(0, Math.min(rango.to, rangoList.length) - rango.from + 1);
              const isGenerating = generatingRangePDFIdx === idx;
              return (
                <Button
                  key={`pdf-${rango.from}-${rango.to}`}
                  onClick={() => handleGenerateRangePDFReport(idx)}
                  disabled={count === 0 || isGenerating || generatingRangeIdx !== null || generatingRangePDFIdx !== null}
                  className="bg-red-600 hover:bg-red-700 text-white w-full min-h-11 text-xs sm:text-sm justify-between"
                >
                  <span className="flex items-center gap-2">
                    {isGenerating ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <FileText className="h-4 w-4 shrink-0" />}
                    {isGenerating ? "Generando..." : `Del ${rango.from} al ${rango.to}`}
                  </span>
                  <span className="font-mono text-[11px] opacity-90">({count})</span>
                </Button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RevaluoList;
