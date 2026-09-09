import { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DataPagination from "@/components/ui/data-pagination";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { RefreshCw, Scale, FileDown, Loader2, Image as ImageIcon } from "lucide-react";
import { useRevaluoData } from "../hooks/useRevaluoData";
import RevaluoFilters from "../components/RevaluoFilters";
import RevaluoTable from "../components/RevaluoTable";
import RevaluoEditModal from "../components/RevaluoEditModal";
import { getCachedCatalog } from "@/lib/catalogCache";
import { useUserDisplayNames } from "@/hooks/useUserDisplayNames";
import { useToast } from "@/hooks/use-toast";
import { normalizeCi, normalizeCiLoose, getCiPrefix } from "@/inventario/constants/inventarioConstants";
import { InventarioImagesModal } from "@/inventario/components/InventarioModals";
import { fetchActivoImages, updateActivoFields } from "@/inventario/services/inventarioService";
import { generateRevaluoReportWithPhotos } from "../services/revaluoReport";

const INITIAL_FILTERS = {
  codigoActivo: "",
  estadoConservacion: "TODOS",
  estado: "TODOS",
  ubicacion: "",
  carnet: "",
  rubro: "TODOS",
  tipoRubro: "TODOS",
  inventariador: "",
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
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

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

  const enrichedAll = useMemo(() => {
    const mapped = (data || []).map((a) => {
      const codigoActivo = a.codigoactivo ?? a.codigoActivo;
      const codigoActivoInterno = a.codigoactivointerno ?? a.codigoActivoInterno;
      const tipoRubroAct = a.tiporubroact ?? a.tipoRubroAct;
      const rubroDesc = rubroFromTipo[tipoRubroAct] ?? rubroFromTipo[String(tipoRubroAct)] ?? "—";
      const tipoDesc = tipoRubroDescMap[tipoRubroAct] ?? tipoRubroDescMap[String(tipoRubroAct)] ?? String(tipoRubroAct || "—");
      const ambCode = String(a.codigoambiente ?? a.codigoAmbiente ?? "").trim();
      const ubicacion = getAmbienteName(ambCode);
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
        _responsableName: responsableName,
        _carnet: ciRaw || "—",
        _inventariador: inventariador,
        _estadoConservacion: estadoCons,
        _valorActual: valorFmt,
        _valorRaw: valorRaw,
        _ambienteKey: ambCode,
        marcaMaterial: a.marcamaterial ?? a.marcaMaterial,
        modelo: a.modelo,
        serie: a.serie,
        observaciones: a.observaciones,
        estadoconservacion: a.estadoconservacion,
      };
    });
    return mapped.sort((a, b) => String(a._ubicacion || "").localeCompare(String(b._ubicacion || ""), "es", { sensitivity: "base" }));
  }, [data, rubroFromTipo, tipoRubroDescMap, getAmbienteName, getResponsableName, getDisplayName]);

  const filteredEnriched = useMemo(() => {
    const codigo = String(appliedFilters.codigoActivo || "").trim().toLowerCase();
    const estadoCons = String(appliedFilters.estadoConservacion || "TODOS").trim().toUpperCase();
    const estadoAltaBaja = String(appliedFilters.estado || "TODOS").trim().toUpperCase();
    const ubicacion = String(appliedFilters.ubicacion || "").trim().toLowerCase();
    const carnet = String(appliedFilters.carnet || "").trim().toLowerCase();
    const rubro = String(appliedFilters.rubro || "TODOS").trim();
    const tipoRubro = String(appliedFilters.tipoRubro || "TODOS").trim();
    const inventariador = String(appliedFilters.inventariador || "").trim().toLowerCase();

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
      if (inventariador && !String(a._inventariador || "").toLowerCase().includes(inventariador) && !String(a.usuarioinventario || "").toLowerCase().includes(inventariador)) return false;
      return true;
    });
  }, [enrichedAll, appliedFilters]);

  const totalPages = Math.max(1, Math.ceil(filteredEnriched.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedData = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredEnriched.slice(start, start + pageSize);
  }, [filteredEnriched, safeCurrentPage, pageSize]);

  const [photoCounts, setPhotoCounts] = useState({});

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
    appliedFilters.inventariador
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

  const handleGenerateReport = async () => {
    if (filteredEnriched.length === 0) {
      toast({ title: "Sin datos", description: "No hay activos para generar el reporte con los filtros actuales.", variant: "destructive" });
      return;
    }
    if (filteredEnriched.length > 200) {
      const confirmed = window.confirm(
        `Se generará un reporte con ${filteredEnriched.length} activos incluyendo fotos. Esto puede tardar varios minutos. ¿Desea continuar?`
      );
      if (!confirmed) return;
    }
    setIsGeneratingReport(true);
    toast({ title: "Generando reporte", description: `Preparando ${filteredEnriched.length} activos con fotos...` });
    try {
      await generateRevaluoReportWithPhotos({
        activos: filteredEnriched,
        onProgress: (current, total) => {
          if (current % 50 === 0 || current === total) {
            console.log(`Reporte progreso ${current}/${total}`);
          }
        },
      });
      toast({ title: "Reporte generado", description: `PDF con ${filteredEnriched.length} activos y sus fotos descargado.` });
    } catch (err) {
      console.error("Error generando reporte:", err);
      toast({ title: "Error", description: `No se pudo generar el reporte: ${err.message || ""}`, variant: "destructive" });
    } finally {
      setIsGeneratingReport(false);
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Scale className="h-6 w-6 text-emerald-600" />
            REVALUO
          </h1>
          <p className="text-muted-foreground">Listado de activos para Revalúo Ordenado por Ubicación</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleGenerateReport} disabled={isGeneratingReport || filteredEnriched.length === 0} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {isGeneratingReport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
            {isGeneratingReport ? "Generando..." : `Reporte con Fotos (${filteredEnriched.length})`}
          </Button>
          <Button variant="outline" onClick={fetchRevaluo} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Actualizar
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Activos para Revalúo
            </span>
            <span className="text-sm font-normal text-muted-foreground">
              {filteredEnriched.length} de {data.length} activos
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RevaluoTable activos={paginatedData} hasActiveFilters={hasActiveFilters} onEdit={handleEdit} onOpenImages={handleOpenImages} photoCounts={photoCounts} />
          {filteredEnriched.length > 0 && (
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
    </div>
  );
};

export default RevaluoList;
