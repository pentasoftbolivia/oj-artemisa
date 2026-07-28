import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSelector } from "react-redux";
import { supabase, fetchAllFromTable } from "@/lib/supabase";
import { toCamelCaseArray } from "@/lib/mapFields";
import { selectUser } from "@/store/auth/authSlice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import LoadingSpinner from "@/components/ui/loading-spinner";
import DataPagination from "@/components/ui/data-pagination";
import {
  ArrowLeft, Plus, Edit, Search, Package, Filter, X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const normalizeKey = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

const RUBRO_ALIAS = {
  "equipo de oficina y muebles": "equipos de oficina y muebles",
  "equipos de comunicaciones": "equipos de comunicación",
  "equipos de comunicaciónes": "equipos de comunicación",
  "equipo de comunicaciones": "equipos de comunicación",
  "equipo de comunicaciónes": "equipos de comunicación",
  "equipo de comunicación": "equipos de comunicación",
  "equipo de computación": "equipos de computación",
  "equipo de computacion": "equipos de computación",
  "equipos de computacion": "equipos de computación",
  "maquinaria y equipos": "maquinaria y equipo",
  "maquinarias y equipo": "maquinaria y equipo",
  "maquinarias y equipos": "maquinaria y equipo",
  "maquinaria y equipo de produccion": "maquinaria y equipo",
  "maquinaria y equipo de producción": "maquinaria y equipo",
  "otro equipo y maquinaria": "otros equipos y maquinaria",
  "otros equipos y maquinarias": "otros equipos y maquinaria",
  "otro equipo y maquinarias": "otros equipos y maquinaria",
  "otro activo fijo": "otros activos fijos",
  "otros activo fijo": "otros activos fijos",
  "otro activos fijos": "otros activos fijos",
};

const RUBRO_FIELDS_RAW = {
  "EQUIPO EDUCACIONAL Y RECREATIVO": [
    { key: "modelo", label: "Modelo" },
    { key: "capacidad", label: "Capacidad" },
    { key: "dimension", label: "Dimensión" },
    { key: "fuentealimentacion", label: "Fuente de Alimentación" },
    { key: "accesorios", label: "Accesorios" },
  ],
  "EQUIPO DE TRANSPORTE, ELEVACIÓN Y TRACCIÓN": [
    { key: "numeromotor", label: "Número de Motor" },
    { key: "numerochasis", label: "Número de Chasis" },
    { key: "serial", label: "Serial" },
    { key: "placamatricula", label: "Placa Matrícula" },
    { key: "capacidadcargatraccion", label: "Capacidad de Carga/Tracción" },
  ],
  "EQUIPOS DE COMUNICACIÓN": [
    { key: "alcancecobertura", label: "Alcance y Cobertura" },
  ],
  "EQUIPOS DE OFICINA Y MUEBLES": [
    { key: "medidas", label: "Medidas" },
    { key: "color", label: "Color" },
    { key: "divisionescajonesbandejas", label: "Divisiones/Cajones/Bandejas" },
    { key: "chapa", label: "Chapa" },
    { key: "abatible", label: "Abatible" },
    { key: "deslizable", label: "Deslizable" },
  ],
  "EQUIPOS DE COMPUTACIÓN": [
    { key: "ram", label: "RAM" },
    { key: "procesador", label: "Procesador" },
    { key: "discoduro", label: "Disco Duro" },
  ],
  "MAQUINARIA Y EQUIPO": [
    { key: "potencia", label: "Potencia" },
    { key: "horometro", label: "Horómetro" },
    { key: "combustibleenergia", label: "Combustible/Energía" },
  ],
  "OTROS EQUIPOS Y MAQUINARIA": [
    { key: "potencia", label: "Potencia" },
    { key: "funcion", label: "Función" },
  ],
  "OTROS ACTIVOS FIJOS": [
    { key: "categoria", label: "Categoría" },
    { key: "caracteristicas", label: "Características" },
  ],
};

const RUBRO_FIELDS = {};
Object.entries(RUBRO_FIELDS_RAW).forEach(([key, fields]) => {
  RUBRO_FIELDS[normalizeKey(key)] = fields;
});

const getRubroFields = (rubroDesc) => {
  const key = RUBRO_ALIAS[normalizeKey(rubroDesc)] || normalizeKey(rubroDesc);
  return RUBRO_FIELDS[key] || [];
};

const BASE_EDIT_FIELDS = [
  { key: "codigoActivo", label: "Código Activo", type: "text", readonly: true },
  { key: "rubro", label: "Rubro", type: "text", readonly: true },
  { key: "tipoRubro", label: "Tipo Rubro", type: "text", readonly: true },
  { key: "descripcionActivo", label: "Descripción del Activo", type: "text" },
  { key: "codigoAmbiente", label: "Ambiente", type: "select" },
];

const PAGE_SIZE = 100;

const normalizeCi = (v) => String(v ?? "").replace(/[^\d]/g, "");
const normalizeCiLoose = (v) => normalizeCi(v).replace(/^0+/, "") || "0";
const getCiPrefix = (ci) => String(ci ?? "").match(/^\d+/)?.[0] ?? "";

const InventarioList = () => {
  const { toast } = useToast();
  const currentUser = useSelector(selectUser);

  const [showSearch, setShowSearch] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activos, setActivos] = useState([]);
  const [rubros, setRubros] = useState([]);
  const [tipoRubros, setTipoRubros] = useState([]);
  const [ambientes, setAmbientes] = useState([]);
  const [responsables, setResponsables] = useState([]);

  const [filtroCodigoActivo, setFiltroCodigoActivo] = useState("");
  const [filtroInventariador, setFiltroInventariador] = useState("");

  const [searchCarnet, setSearchCarnet] = useState("");
  const [searchNombre, setSearchNombre] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const [directAmbMap, setDirectAmbMap] = useState({});
  const [directRespMap, setDirectRespMap] = useState({});
  const ambientesRef = useRef([]);
  const responsablesRef = useRef([]);
  const directAmbRef = useRef({});
  const directRespRef = useRef({});

  const [editActivo, setEditActivo] = useState(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const rubroDescMap = useMemo(() => {
    const map = {};
    (rubros || []).forEach(r => {
      map[r.codigorubroact] = r.descripcionrubroact;
      map[String(r.codigorubroact)] = r.descripcionrubroact;
    });
    return map;
  }, [rubros]);

  const rubroFromTipo = useMemo(() => {
    const map = {};
    (tipoRubros || []).forEach(t => {
      map[t.tiporubroact] = rubroDescMap[t.codigorubroact];
      map[String(t.tiporubroact)] = rubroDescMap[t.codigorubroact];
    });
    return map;
  }, [tipoRubros, rubroDescMap]);

  const tipoRubroDescMap = useMemo(() => {
    const map = {};
    (tipoRubros || []).forEach(t => {
      map[t.tiporubroact] = t.descripciontiporubroact;
      map[String(t.tiporubroact)] = t.descripciontiporubroact;
    });
    return map;
  }, [tipoRubros]);

  const inventariadorStats = useMemo(() => {
    const stats = {};
    if (currentUser?.email) {
      stats[currentUser.email] = { aprobado: 0, pendiente: 0 };
    }
    (activos || []).forEach(a => {
      const val = a.usuarioinventario;
      if (!val) return;

      const isPending = val === "PENDIENTE" || val.startsWith("PENDIENTE:");
      const email = val.replace("PENDIENTE:", "");

      if (email === "APROBADO") return;

      if (!stats[email]) {
        stats[email] = { aprobado: 0, pendiente: 0 };
      }

      if (isPending) {
        stats[email].pendiente++;
      } else {
        stats[email].aprobado++;
      }
    });
    return Object.entries(stats).map(([email, count]) => ({
      email,
      ...count
    }));
  }, [activos, currentUser]);

  const ambienteMap = useMemo(() => {
    const map = {};
    (ambientes.length > 0 ? ambientes : ambientesRef.current).forEach(a => {
      const code = String(a.codigoambiente ?? "").trim();
      if (code) { map[code] = a.ambiente; }
    });
    return map;
  }, [ambientes]);

  const responsableMap = useMemo(() => {
    const map = {};
    (responsables.length > 0 ? responsables : responsablesRef.current).forEach(r => {
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

  const loadCatalogos = useCallback(async () => {
    const [rubroRes, tipoRes] = await Promise.all([
      supabase.from("act_rubro").select("*").order("descripcionrubroact", { ascending: true }),
      supabase.from("act_tiporubro").select("*").order("descripciontiporubroact", { ascending: true }),
    ]);
    if (!rubroRes.error) setRubros(rubroRes.data || []);
    else console.error("Error loading rubros:", rubroRes.error);
    if (!tipoRes.error) setTipoRubros(tipoRes.data || []);
    else console.error("Error loading tipoRubros:", tipoRes.error);

    try {
      const [ambData, respData] = await Promise.all([
        fetchAllFromTable("act_ambiente", "*", { orderColumn: "ambiente", ascending: true }),
        fetchAllFromTable("act_responsable", "*", { orderColumn: "cirun", ascending: true }),
      ]);
      setAmbientes(ambData || []);
      ambientesRef.current = ambData || [];
      setResponsables(respData || []);
      responsablesRef.current = respData || [];
    } catch (err) {
      console.error("Error loading catalogos:", err);
    }
  }, []);

  const loadActivos = useCallback(async (filters = {}) => {
    const { codigoActivo = "", inventariador = "", carnet = "", nombre = "" } = filters;
    setIsLoading(true);
    try {
      let ciFilter = [];

      if (nombre.trim()) {
        const words = nombre.trim().split(/\s+/).filter(Boolean);
        let respQuery = supabase.from("act_responsable").select("cirun");
        words.forEach(word => {
          respQuery = respQuery.or(`nombre1.ilike.%${word}%,nombre2.ilike.%${word}%,paterno.ilike.%${word}%,materno.ilike.%${word}%`);
        });

        const { data: matchingResp, error: respError } = await respQuery;

        if (respError) throw respError;

        if (!matchingResp || matchingResp.length === 0) {
          setActivos([]);
          setIsLoading(false);
          return;
        }
        ciFilter = matchingResp.map(r => normalizeCi(r.cirun));
      }

      const BATCH_SIZE = 1000;
      let allData = [];
      let totalCount = 0;
      let lastCodigoActivo = null;

      for (let i = 0; ; i++) {
        let batchQuery = supabase
          .from("act_activos")
          .select("*", { count: i === 0 ? "exact" : undefined })
          .eq("ultimoregistro", 1)
          .order("codigoactivointerno", { ascending: true })
          .limit(BATCH_SIZE);

        if (lastCodigoActivo != null) {
          batchQuery = batchQuery.gt("codigoactivointerno", lastCodigoActivo);
        }

        if (codigoActivo.trim()) {
          const val = codigoActivo.trim().replace(/%/g, "");
          const numVal = Number(val);
          if (!isNaN(numVal)) {
            batchQuery = batchQuery.eq("codigoactivo", numVal);
          } else {
            batchQuery = batchQuery.eq("codigoactivo", -1);
          }
        }

        if (inventariador.trim()) {
          const val = inventariador.trim().replace(/%/g, "");
          batchQuery = batchQuery.ilike("usuarioinventario", `%${val}%`);
        }

        if (carnet.trim()) {
          const ci = carnet.trim().replace(/%/g, "");
          batchQuery = batchQuery.ilike("cirun", `%${ci}%`);
        }

        if (ciFilter.length > 0) {
          batchQuery = batchQuery.in("cirun", ciFilter);
        }

        const { data: batch, error: batchError, count } = await batchQuery;
        if (batchError) throw batchError;

        if (i === 0) totalCount = count || 0;
        if (batch && batch.length > 0) {
          allData = allData.concat(batch);
          lastCodigoActivo = batch[batch.length - 1].codigoactivointerno;
        }
        if (!batch || batch.length < BATCH_SIZE) break;
      }

      const data = allData;
      const count = totalCount;

      const directAmb = {};
      if (data) {
        const uniqueAmbCodes = [...new Set(data.map(a => String(a.codigoambiente ?? "").trim()).filter(Boolean))];
        if (uniqueAmbCodes.length > 0) {
          const { data: ambData } = await supabase.from("act_ambiente").select("codigoambiente, ambiente").in("codigoambiente", uniqueAmbCodes);
          if (ambData) {
            ambData.forEach(a => { const code = String(a.codigoambiente ?? "").trim(); if (code) directAmb[code] = a.ambiente; });
          }
        }
      }
      setDirectAmbMap(directAmb);
      directAmbRef.current = directAmb;

      const directResp = {};
      if (data) {
        const uniqueCirs = [...new Set(data.map(a => String(a.cirun ?? "").trim()).filter(Boolean))];
        if (uniqueCirs.length > 0) {
          const { data: respData } = await supabase.from("act_responsable").select("*").in("cirun", uniqueCirs);
          if (respData) {
            respData.forEach(r => {
              const raw = String(r.cirun ?? "").trim();
              directResp[raw] = r;
              const norm = normalizeCi(r.cirun);
              if (norm !== raw) directResp[norm] = r;
              const loose = normalizeCiLoose(r.cirun);
              if (loose !== raw && loose !== norm) directResp[loose] = r;
              const prefix = getCiPrefix(raw);
              if (prefix && prefix !== raw && prefix !== norm && prefix !== loose) directResp[prefix] = r;
            });
          }
        }
      }
      setDirectRespMap(directResp);
      directRespRef.current = directResp;

      setActivos(toCamelCaseArray(data || []));
    } catch (err) {
      toast({ title: "Error", description: `Error al cargar activos: ${err.message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    await loadCatalogos();
    setIsLoading(false);
  }, [loadCatalogos]);

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
    loadActivos({ codigoActivo: filtroCodigoActivo, inventariador: filtroInventariador });
  };

  const clearFilters = () => {
    setCurrentPage(1);
    setFiltroCodigoActivo("");
    setFiltroInventariador("");
    loadActivos({});
  };

  const handleSearch = () => {
    setCurrentPage(1);
    loadActivos({ carnet: searchCarnet, nombre: searchNombre });
  };

  const clearSearch = () => {
    setCurrentPage(1);
    setSearchCarnet("");
    setSearchNombre("");
    loadActivos({});
  };

  const handleEdit = (activo) => {
    const rubroDesc = rubroFromTipo[activo.tipoRubroAct] || "";
    const tipoDesc = tipoRubroDescMap[activo.tipoRubroAct] || "";
    setEditActivo(activo);
    setEditForm({
      codigoActivo: activo.codigoActivo != null ? String(activo.codigoActivo) : "",
      rubro: rubroDesc,
      tipoRubro: tipoDesc,
      descripcionActivo: (activo.descripcionActivo || "").trim(),
      codigoAmbiente: String(activo.codigoAmbiente ?? "").trim(),
      ...getRubroFieldValues(activo, rubroDesc),
    });
    setIsEditOpen(true);
  };

  const getRubroFieldValues = (activo, rubroDesc) => {
    const fields = getRubroFields(rubroDesc);
    const values = {};
    fields.forEach(f => {
      values[f.key] = activo[f.key] != null ? String(activo[f.key]) : "";
    });
    return values;
  };

  const getEditFieldsForRubro = (rubroDesc) => {
    return getRubroFields(rubroDesc);
  };

  const handleEditChange = (e) => {
    const { id, value } = e.target;
    setEditForm(p => ({ ...p, [id]: value }));
  };

  const handleEditSelectChange = (field, value) => {
    setEditForm(p => ({ ...p, [field]: value }));
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
      rubroFields.forEach(f => {
        const val = editForm[f.key];
        fieldsToUpdate[f.key] = val || null;
      });

      const userEmail = currentUser?.email || "unknown";
      fieldsToUpdate.usuarioinventario = userEmail;

      const { error } = await supabase
        .from("act_activos")
        .update(fieldsToUpdate)
        .eq("codigoactivointerno", editActivo.codigoActivoInterno);

      if (error) throw error;

      toast({ title: "Éxito", description: "Activo actualizado correctamente." });
      setIsEditOpen(false);
      setEditActivo(null);
      loadActivos({ codigoActivo: filtroCodigoActivo, inventariador: filtroInventariador });
    } catch (err) {
      toast({ title: "Error", description: `Error al actualizar: ${err.message}`, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAprobado = async (activo) => {
    try {
      const val = activo.usuarioinventario || "";
      const isCurrentlyApproved = !!val && val !== "APROBADO" && !val.startsWith("PENDIENTE:");

      let newUserEmail;
      if (isCurrentlyApproved) {
        newUserEmail = `PENDIENTE:${val}`;
      } else if (val === "APROBADO") {
        newUserEmail = null;
      } else if (val.startsWith("PENDIENTE:")) {
        newUserEmail = val.replace("PENDIENTE:", "");
      } else {
        newUserEmail = "APROBADO";
      }

      const { error } = await supabase
        .from("act_activos")
        .update({ usuarioinventario: newUserEmail })
        .eq("codigoactivointerno", activo.codigoActivoInterno);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: (isCurrentlyApproved || val === "APROBADO")
          ? "Estado de inventario cambiado a PENDIENTE."
          : "Estado de inventario cambiado a APROBADO."
      });
      setActivos(prev => prev.map(a =>
        a.codigoActivoInterno === activo.codigoActivoInterno
          ? { ...a, usuarioinventario: newUserEmail }
          : a
      ));
    } catch (err) {
      toast({ title: "Error", description: `Error al actualizar: ${err.message}`, variant: "destructive" });
    }
  };

  const handleToggleEnviado = async (activo) => {
    try {
      const isEnviado = activo.estado === "ENVIADO";
      const nuevoEstado = isEnviado ? "PENDIENTE" : "ENVIADO";

      const { error } = await supabase
        .from("act_activos")
        .update({ estado: nuevoEstado })
        .eq("codigoactivointerno", activo.codigoActivoInterno);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: `Estado cambiado a ${nuevoEstado}.`,
      });
      setActivos((prev) =>
        prev.map((a) =>
          a.codigoActivoInterno === activo.codigoActivoInterno
            ? { ...a, estado: nuevoEstado }
            : a
        )
      );
    } catch (err) {
      toast({
        title: "Error",
        description: `Error al actualizar: ${err.message}`,
        variant: "destructive",
      });
    }
  };

  const renderEditFields = () => {
    if (!editActivo) return null;
    const rubroDesc = rubroFromTipo[editActivo.tipoRubroAct] || "";
    const fields = getEditFieldsForRubro(rubroDesc);

    return fields.map(f => (
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

  const ambMap = Object.keys(directAmbMap).length > 0 ? directAmbMap : directAmbRef.current;
  const ambCatMap = Object.keys(ambienteMap).length > 0 ? ambienteMap : (() => { const m = {}; ambientesRef.current.forEach(a => { const c = String(a.codigoambiente ?? "").trim(); if (c) m[c] = a.ambiente; }); return m; })();

  const getAmbienteName = (code) => {
    const c = String(code ?? "").trim();
    return ambMap[c] ?? ambCatMap[c] ?? (c || "—");
  };

  const respMap = Object.keys(directRespMap).length > 0 ? directRespMap : directRespRef.current;
  const respCatMap = Object.keys(responsableMap).length > 0 ? responsableMap : (() => { const m = {}; (responsablesRef.current || []).forEach(r => { const raw = String(r.cirun ?? "").trim(); m[raw] = r; const norm = normalizeCi(r.cirun); if (norm !== raw) m[norm] = r; const loose = normalizeCiLoose(r.cirun); if (loose !== raw && loose !== norm) m[loose] = r; const prefix = getCiPrefix(raw); if (prefix && prefix !== raw && prefix !== norm && prefix !== loose) m[prefix] = r; }); return m; })();

  const getResponsableName = (cirun) => {
    const rawCi = String(cirun ?? "").trim();
    if (!rawCi) return "—";
    const normCi = normalizeCi(rawCi);
    const looseCi = normalizeCiLoose(rawCi);
    const prefixCi = getCiPrefix(rawCi);
    const resp = respMap[normCi] || respMap[looseCi] || respMap[prefixCi] || respMap[rawCi] || respCatMap[normCi] || respCatMap[looseCi] || respCatMap[prefixCi] || respCatMap[rawCi];
    return resp
      ? [resp.nombre1, resp.nombre2, resp.paterno, resp.materno].map(s => (s || "").trim()).filter(Boolean).join(" ") || resp.cirun
      : rawCi || "—";
  };

  const resolvedActivos = useMemo(() => {
    return activos.map(a => {
      const tipoRubro = tipoRubros.find(t => String(t.tiporubroact) === String(a.tipoRubroAct));
      const rubroDesc = rubroDescMap[tipoRubro?.codigorubroact] ?? rubroDescMap[String(tipoRubro?.codigorubroact)] ?? "—";
      const tipoDesc = tipoRubroDescMap[a.tipoRubroAct] ?? tipoRubroDescMap[String(a.tipoRubroAct)] ?? "—";
      const ambCode = String(a.codigoAmbiente ?? "").trim();
      const amb = directAmbMap[ambCode] ?? ambienteMap[ambCode] ?? (ambCode || "—");
      const rawCi = String(a.cirun ?? "").trim();
      const normCi = normalizeCi(rawCi);
      const looseCi = normalizeCiLoose(rawCi);
      const prefixCi = getCiPrefix(rawCi);
      const resp = directRespMap[normCi] || directRespMap[looseCi] || directRespMap[prefixCi] || directRespMap[rawCi] || responsableMap[normCi] || responsableMap[looseCi] || responsableMap[prefixCi] || responsableMap[rawCi];
      const respName = resp
        ? [resp.nombre1, resp.nombre2, resp.paterno, resp.materno].map(s => (s || "").trim()).filter(Boolean).join(" ") || resp.cirun
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
  }, [activos, rubroDescMap, tipoRubroDescMap, ambienteMap, responsableMap, tipoRubros, directAmbMap, directRespMap]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(resolvedActivos.length / pageSize)), [resolvedActivos.length, pageSize]);
  const safeCurrentPage = useMemo(() => Math.min(currentPage, totalPages), [currentPage, totalPages]);
  const paginatedData = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return resolvedActivos.slice(start, start + pageSize);
  }, [resolvedActivos, safeCurrentPage, pageSize]);

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
            <h1 className="text-2xl font-bold tracking-tight">LISTA DE ACTIVOS POR BUSQUEDA</h1>
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
                <Label htmlFor="searchNombre">Nombres o Apellidos del Responsable</Label>
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
                    <TableHead>Carnet Responsable</TableHead>
                    <TableHead className="text-center">Acciones</TableHead>
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
                        <TableCell className="text-right">
                          <div className="flex space-x-1 justify-end">
                            {a.estado !== "ENVIADO" && (
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
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleEnviado(a)}
                              className={
                                a.estado === "ENVIADO"
                                  ? "text-orange-500 hover:text-orange-700 font-bold"
                                  : "text-red-500 hover:text-red-700 font-bold"
                              }
                            >
                              {a.estado === "ENVIADO" ? "ENVIADO" : "PENDIENTE"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        <Package className="mx-auto h-12 w-12 opacity-20 mb-2" />
                        <p className="text-lg font-medium">
                          {isLoading ? "Cargando..." : "No se encontraron activos"}
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
                onPageSizeChange={(newSize) => { setPageSize(newSize); setCurrentPage(1); }}
              />
            )}
          </CardContent>
        </Card>

        <Dialog open={isEditOpen} onOpenChange={(open) => { if (!open) { setIsEditOpen(false); setEditActivo(null); } }}>
          <DialogContent className="sm:max-w-[600px]" onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>Editar Activo</DialogTitle>
              <DialogDescription>
                Modifica los datos del activo fijo
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
              {BASE_EDIT_FIELDS.map(f => {
                if (f.type === "select") {
                  return (
                    <div key={f.key} className="space-y-2">
                      <Label htmlFor={f.key}>{f.label}</Label>
                      <Select
                        value={editForm.codigoAmbiente}
                        onValueChange={(v) => handleEditSelectChange("codigoAmbiente", v)}
                        disabled={isSaving}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Seleccionar ambiente" />
                        </SelectTrigger>
                        <SelectContent>
                          {ambientes.map(a => (
                            <SelectItem key={a.codigoambiente} value={String(a.codigoambiente).trim()}>
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
              <Button variant="outline" onClick={() => { setIsEditOpen(false); setEditActivo(null); }} disabled={isSaving}>
                Cancelar
              </Button>
              <Button onClick={handleEditSave} disabled={isSaving}>
                {isSaving ? "Guardando..." : "Guardar"}
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
          <h1 className="text-2xl font-bold tracking-tight">INVENTARIO</h1>
          <p className="text-muted-foreground">
            Gestión de inventario de activos fijos
          </p>
        </div>
        <Button onClick={() => { setShowSearch(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          NUEVO
        </Button>
      </div>

      {inventariadorStats.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Resumen por Inventariador</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {inventariadorStats.map((stat) => (
                <div key={stat.email} className="rounded-lg border p-4 bg-muted/20 space-y-2">
                  <div className="text-xs font-semibold truncate text-muted-foreground" title={stat.email}>
                    {stat.email}
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded p-2 text-center">
                      <div className="text-xs text-green-600 dark:text-green-400 font-medium">Aprobados</div>
                      <div className="text-lg font-bold text-green-700 dark:text-green-300">{stat.aprobado}</div>
                    </div>
                    <div className="flex-1 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded p-2 text-center">
                      <div className="text-xs text-orange-600 dark:text-orange-400 font-medium">Pendientes</div>
                      <div className="text-lg font-bold text-orange-700 dark:text-orange-300">{stat.pendiente}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
              <Label htmlFor="filtroCodigoActivo">Código Activo</Label>
              <Input
                id="filtroCodigoActivo"
                placeholder="Buscar por código activo..."
                value={filtroCodigoActivo}
                onChange={(e) => setFiltroCodigoActivo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filtroInventariador">Inventariador</Label>
              <Input
                id="filtroInventariador"
                placeholder="Buscar por inventariador..."
                value={filtroInventariador}
                onChange={(e) => setFiltroInventariador(e.target.value)}
              />
            </div>
            <div className="space-y-2 flex items-end gap-2">
              <Button onClick={handleFilter}>
                <Search className="h-4 w-4 mr-2" />
                Buscar
              </Button>
              <Button
                variant="outline"
                onClick={clearFilters}
                disabled={!filtroCodigoActivo && !filtroInventariador}
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
            Lista de Activos
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
                  <TableHead>Carnet Responsable</TableHead>
                  <TableHead>Inventariador</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length > 0 ? (
                  paginatedData.map((a) => {
                    const isApproved = !!a.usuarioinventario && a.usuarioinventario !== "PENDIENTE" && !a.usuarioinventario.startsWith("PENDIENTE:");
                    const displayInventariador = a.usuarioinventario && a.usuarioinventario !== "APROBADO" && a.usuarioinventario !== "PENDIENTE" ? a.usuarioinventario.replace("PENDIENTE:", "") : "—";
                    return (
                      <TableRow
                        key={a.codigoActivoInterno}
                        className={isApproved
                          ? "bg-green-50/70 hover:bg-green-100/70 dark:bg-green-950/20 dark:hover:bg-green-900/30"
                          : "bg-orange-50/50 hover:bg-orange-100/50 dark:bg-orange-950/10 dark:hover:bg-orange-900/20"
                        }
                      >
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
                        <TableCell className="text-xs max-w-[150px] truncate" title={displayInventariador}>
                          {displayInventariador}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex space-x-1 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(a)}
                              className="text-yellow-500 hover:text-yellow-700"
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              EDITAR
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleToggleAprobado(a)}
                              className={isApproved ? "bg-green-600 hover:bg-green-700 text-white" : "bg-orange-500 hover:bg-orange-600 text-white"}
                            >
                              {isApproved ? "APROBADO" : "PENDIENTE"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      <Package className="mx-auto h-12 w-12 opacity-20 mb-2" />
                      <p className="text-lg font-medium">
                        {isLoading ? "Cargando..." : "No se encontraron activos"}
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
              onPageSizeChange={(newSize) => { setPageSize(newSize); setCurrentPage(1); }}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={(open) => { if (!open) { setIsEditOpen(false); setEditActivo(null); } }}>
        <DialogContent className="sm:max-w-[600px]" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Editar Activo</DialogTitle>
            <DialogDescription>
              Modifica los datos del activo fijo
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            {BASE_EDIT_FIELDS.map(f => {
              if (f.type === "select") {
                return (
                  <div key={f.key} className="space-y-2">
                    <Label htmlFor={f.key}>{f.label}</Label>
                    <Select
                      value={editForm.codigoAmbiente}
                      onValueChange={(v) => handleEditSelectChange("codigoAmbiente", v)}
                      disabled={isSaving}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleccionar ambiente" />
                      </SelectTrigger>
                      <SelectContent>
                        {ambientes.map(a => (
                          <SelectItem key={a.codigoambiente} value={String(a.codigoambiente).trim()}>
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
            <Button variant="outline" onClick={() => { setIsEditOpen(false); setEditActivo(null); }} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleEditSave} disabled={isSaving}>
              {isSaving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InventarioList;
