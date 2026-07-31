import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";

import { supabase } from "@/lib/supabase";
import { createOptionsList } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ComboboxField from "@/components/ui/combobox-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import LoadingSpinner from "@/components/ui/loading-spinner";
import DataPagination from "@/components/ui/data-pagination";
import {
  Plus,
  Edit,
  Trash2,
  Package,
  Filter,
  X,
  Barcode,
  QrCode,
  Printer,
  Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import JsBarcode from "jsbarcode";
import { jsPDF } from "jspdf";
import { generateQRLabel } from "../helpers/generateQRLabel";

import {
  fetchActivosFijosPaginated,
  addActivoFijo,
  updateActivoFijo,
  deleteActivoFijo,
} from "@/store/activosFijos/activosFijosThunks";
import {
  selectActivosFijos,
  selectActivosFijosTotalCount,
  selectActivosFijosLoading,
  selectActivosFijosError,
} from "@/store/activosFijos/activosFijosSlice";

import ActivosFijosForm from "./ActivosFijosForm";

const INITIAL_FILTERS = { search: "", rubro: "", carnet: "", ciudad: "", ambiente: "", inmueble: "", nivel: "" };
const ESTADO_MAP = { 1: "Activo", 0: "Inactivo" };
const DEBOUNCE_MS = 300;
const formatCodigoActivo = (a) =>
  a?.codigoActivo != null ? `OJ-02-${a.codigoActivo}` : "";

const ActivosFijosList = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();
  const activosFijos = useSelector(selectActivosFijos);
  const totalCount = useSelector(selectActivosFijosTotalCount);
  const isLoading = useSelector(selectActivosFijosLoading);
  const error = useSelector(selectActivosFijosError);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingActivo, setEditingActivo] = useState(null);
  const [activoToDelete, setActivoToDelete] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [filters, setFilters] = useState({ ...INITIAL_FILTERS });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debouncedCarnet, setDebouncedCarnet] = useState("");
  const isFirstRender = useRef(true);
  const debounceTimer = useRef(null);

  const [barcodeActivo, setBarcodeActivo] = useState(null);
  const [qrActivo, setQrActivo] = useState(null);
  const [barcodeDataUrl, setBarcodeDataUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [isQrPrintOpen, setIsQrPrintOpen] = useState(false);
  const [qrLabels, setQrLabels] = useState([]);
  const [isGeneratingQrs, setIsGeneratingQrs] = useState(false);
  const [tipoRubros, setTipoRubros] = useState([]);
  const [rubros, setRubros] = useState([]);
  const [ambientes, setAmbientes] = useState([]);
  const [ambienteNivel, setAmbienteNivel] = useState([]);
  const [inmuebles, setInmuebles] = useState([]);
  const [niveles, setNiveles] = useState([]);
  const [ciudades, setCiudades] = useState([]);

  useEffect(() => {
    supabase
      .from("act_tiporubro")
      .select("tiporubroact, descripciontiporubroact, codigorubroact")
      .order("descripciontiporubroact", { ascending: true })
      .then(({ data }) => setTipoRubros(data || []));
    supabase
      .from("act_rubro")
      .select("codigorubroact, descripcionrubroact")
      .order("descripcionrubroact", { ascending: true })
      .then(({ data }) => setRubros(data || []));
    (async () => {
      let allAmbientes = [];
      let start = 0;
      const CHUNK = 1000;
      let chunk;
      do {
        const { data } = await supabase
          .from("act_ambiente")
          .select("codigoambiente, ambiente")
          .order("ambiente", { ascending: true })
          .range(start, start + CHUNK - 1);
        chunk = data || [];
        allAmbientes = allAmbientes.concat(chunk);
        start += CHUNK;
      } while (chunk.length === CHUNK);
      setAmbientes(allAmbientes);
    })();
    (async () => {
      let allData = [];
      let start = 0;
      const CHUNK = 1000;
      let chunk;
      do {
        const { data } = await supabase
          .from("act_ambiente")
          .select("codigoambiente, codigonivel")
          .range(start, start + CHUNK - 1);
        chunk = data || [];
        allData = allData.concat(chunk);
        start += CHUNK;
      } while (chunk.length === CHUNK);
      setAmbienteNivel(allData);
    })();
    (async () => {
      let allData = [];
      let start = 0;
      const CHUNK = 1000;
      let chunk;
      do {
        const { data } = await supabase
          .from("act_ambiente")
          .select("codigoambiente, codigonivel")
          .range(start, start + CHUNK - 1);
        chunk = data || [];
        allData = allData.concat(chunk);
        start += CHUNK;
      } while (chunk.length === CHUNK);
      setAmbienteNivel(allData);
    })();
    supabase
      .from("act_inmueble")
      .select("codigoinmueble, inmueble, codigociudad")
      .order("inmueble", { ascending: true })
      .then(({ data }) => setInmuebles(data || []));
    supabase
      .from("act_nivel")
      .select("codigonivel, nivel, codigoinmueble")
      .order("nivel", { ascending: true })
      .then(({ data }) => setNiveles(data || []));
    supabase
      .from("act_ciudad")
      .select("codigociudad, descripcion")
      .order("descripcion", { ascending: true })
      .then(({ data }) => setCiudades(data || []));
  }, []);

  const rubroMap = useMemo(() => {
    const rubroDesc = {};
    (rubros || []).forEach((r) => {
      rubroDesc[r.codigorubroact] = r.descripcionrubroact;
      rubroDesc[String(r.codigorubroact)] = r.descripcionrubroact;
    });
    const tipoToRubro = {};
    (tipoRubros || []).forEach((t) => {
      tipoToRubro[t.tiporubroact] = rubroDesc[t.codigorubroact];
      tipoToRubro[String(t.tiporubroact)] = rubroDesc[t.codigorubroact];
    });
    return tipoToRubro;
  }, [tipoRubros, rubros]);

  const ambienteMap = useMemo(() => {
    const map = {};
    (ambientes || []).forEach((a) => {
      const k = String(a.codigoambiente).trim();
      map[k] = (a.ambiente || "").trim();
    });
    return map;
  }, [ambientes]);

  const ambienteNivelMap = useMemo(() => {
    const map = {};
    (ambienteNivel || []).forEach((a) => {
      const k = String(a.codigoambiente).trim();
      map[k] = a.codigonivel;
    });
    return map;
  }, [ambienteNivel]);

  const nivelMap = useMemo(() => {
    const map = {};
    (niveles || []).forEach((n) => {
      const k = String(n.codigonivel).trim();
      map[k] = (n.nivel || "").trim();
    });
    return map;
  }, [niveles]);

  const nivelInmuebleMap = useMemo(() => {
    const map = {};
    (niveles || []).forEach((n) => {
      const k = String(n.codigonivel).trim();
      map[k] = String(n.codigoinmueble).trim();
    });
    return map;
  }, [niveles]);

  const inmuebleMap = useMemo(() => {
    const map = {};
    (inmuebles || []).forEach((i) => {
      const k = String(i.codigoinmueble).trim();
      map[k] = (i.inmueble || "").trim();
    });
    return map;
  }, [inmuebles]);

  const inmuebleCiudadMap = useMemo(() => {
    const map = {};
    (inmuebles || []).forEach((i) => {
      const k = String(i.codigoinmueble).trim();
      map[k] = String(i.codigociudad ?? "").trim();
    });
    return map;
  }, [inmuebles]);



  const tipoRubroMap = useMemo(() => {
    const map = {};
    (tipoRubros || []).forEach((t) => {
      map[t.tiporubroact] = t.descripciontiporubroact;
      map[String(t.tiporubroact)] = t.descripciontiporubroact;
    });
    return map;
  }, [tipoRubros]);

  const rubroOptions = useMemo(
    () =>
      createOptionsList(rubros || [], "codigorubroact", "descripcionrubroact"),
    [rubros],
  );

  const ciudadOptions = useMemo(
    () =>
      createOptionsList(ciudades || [], "codigociudad", "descripcion"),
    [ciudades],
  );

  const ambienteOptions = useMemo(
    () =>
      createOptionsList(ambientes || [], "codigoambiente", "ambiente"),
    [ambientes],
  );

  const inmuebleOptions = useMemo(
    () =>
      createOptionsList(inmuebles || [], "codigoinmueble", "inmueble"),
    [inmuebles],
  );

  const nivelOptions = useMemo(
    () =>
      createOptionsList(niveles || [], "codigonivel", "nivel"),
    [niveles],
  );

  const inmuebleOptionsByCiudad = useMemo(() => {
    if (!filters.ciudad) return inmuebleOptions;
    const ciudad = String(filters.ciudad).trim();
    return inmuebleOptions.filter(
      (o) => inmuebleCiudadMap[String(o.value).trim()] === ciudad,
    );
  }, [inmuebleOptions, inmuebleCiudadMap, filters.ciudad]);

  const nivelOptionsByInmueble = useMemo(() => {
    if (!filters.inmueble) return nivelOptions;
    const inmueble = String(filters.inmueble).trim();
    return nivelOptions.filter(
      (o) => nivelInmuebleMap[String(o.value).trim()] === inmueble,
    );
  }, [nivelOptions, nivelInmuebleMap, filters.inmueble]);

  const ambienteOptionsByNivel = useMemo(() => {
    if (!filters.nivel) return ambienteOptions;
    const nivel = String(filters.nivel).trim();
    return ambienteOptions.filter(
      (o) => String(ambienteNivelMap[String(o.value).trim()] ?? "") === nivel,
    );
  }, [ambienteOptions, ambienteNivelMap, filters.nivel]);

  const rubroToTipoIds = useMemo(() => {
    const map = {};
    (rubros || []).forEach((r) => {
      map[r.codigorubroact] = [];
      map[String(r.codigorubroact)] = [];
    });
    (tipoRubros || []).forEach((t) => {
      const k = t.codigorubroact;
      const ks = String(k);
      if (map[k]) map[k].push(t.tiporubroact);
      if (map[ks]) map[ks].push(t.tiporubroact);
    });
    return map;
  }, [tipoRubros, rubros]);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setDebouncedSearch(filters.search);
      setDebouncedCarnet(filters.carnet);
      return;
    }
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(filters.search);
      setDebouncedCarnet(filters.carnet);
      setCurrentPage(1);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [filters.search, filters.carnet]);

  useEffect(() => {
    dispatch(
      fetchActivosFijosPaginated({
        page: currentPage,
        pageSize,
        filters: {
          search: debouncedSearch,
          carnet: debouncedCarnet,
          rubro: filters.rubro
            ? rubroToTipoIds[filters.rubro] || []
            : undefined,
          ambiente: filters.ambiente || undefined,
          nivel: filters.nivel || undefined,
          inmueble: filters.inmueble || undefined,
          ciudad: filters.ciudad || undefined,
        },
      }),
    );
  }, [
    currentPage,
    pageSize,
    debouncedSearch,
    debouncedCarnet,
    filters.rubro,
    filters.ambiente,
    filters.nivel,
    filters.inmueble,
    filters.ciudad,
    dispatch,
    rubroToTipoIds,
  ]);

  useEffect(() => {
    if (!barcodeActivo) return;
    const canvas = document.createElement("canvas");
    JsBarcode(canvas, formatCodigoActivo(barcodeActivo), {
      format: "CODE128",
      width: 1.5,
      height: 40,
      displayValue: true,
      fontSize: 12,
      margin: 5,
    });
    setBarcodeDataUrl(canvas.toDataURL("image/png"));
  }, [barcodeActivo]);

  useEffect(() => {
    if (!qrActivo) return;
    const content = formatCodigoActivo(qrActivo);
    const rubro = (rubroMap[qrActivo.tipoRubroAct] ?? rubroMap[qrActivo.tiporubroact] ?? qrActivo.tipoRubroAct ?? qrActivo.tiporubroact ?? "").toString().trim();
    const tipoRubro = (tipoRubroMap[qrActivo.tipoRubroAct] ?? tipoRubroMap[qrActivo.tiporubroact] ?? qrActivo.descripciontiporubroact ?? "").toString().trim();
    generateQRLabel({
      qrContent: content,
      codigoActivo: formatCodigoActivo(qrActivo),
      rubro,
      tipoRubro,
      fecha: new Date().toLocaleDateString("es-ES"),
    }).then(setQrDataUrl);
  }, [qrActivo, rubroMap, tipoRubroMap]);

  const printBarcodePDF = useCallback(() => {
    if (!barcodeDataUrl || !barcodeActivo) return;
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: [50, 25],
    });
    doc.addImage(barcodeDataUrl, "PNG", 3, 3, 44, 14);
    doc.setFontSize(8);
    doc.text(formatCodigoActivo(barcodeActivo), 25, 21, {
      align: "center",
    });
    doc.save(`codigo-barras-${barcodeActivo.codigoActivo}.pdf`);
  }, [barcodeDataUrl, barcodeActivo]);

  const printQRPDF = useCallback(() => {
    if (!qrDataUrl || !qrActivo) return;
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: [50, 25],
    });
    doc.addImage(qrDataUrl, "PNG", 0, 0, 50, 25);
    doc.save(`codigo-qr-${qrActivo.codigoActivo}.pdf`);
  }, [qrDataUrl, qrActivo]);

  const generateBulkQRLabels = useCallback(
    async (items) => {
      const labels = [];
      for (const item of items) {
        const content = formatCodigoActivo(item);
        const rubro = (rubroMap[item.tipoRubroAct] ?? rubroMap[item.tiporubroact] ?? item.tipoRubroAct ?? item.tiporubroact ?? "").toString().trim();
        const tipoRubro = (tipoRubroMap[item.tipoRubroAct] ?? tipoRubroMap[item.tiporubroact] ?? item.descripciontiporubroact ?? "").toString().trim();
        const dataUrl = await generateQRLabel({
          qrContent: content,
          codigoActivo: content,
          rubro,
          tipoRubro,
          fecha: new Date().toLocaleDateString("es-ES"),
        });
        labels.push({ codigoActivo: content, dataUrl });
      }
      return labels;
    },
    [rubroMap, tipoRubroMap],
  );

  const handlePrintQRs = useCallback(async () => {
    if (!activosFijos.length) return;
    setIsGeneratingQrs(true);
    try {
      const labels = await generateBulkQRLabels(activosFijos);
      setQrLabels(labels);
      setIsQrPrintOpen(true);
    } catch (err) {
      toast({
        title: "Error",
        description: `Fallo al generar QRs: ${err.message || "Error desconocido"}`,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingQrs(false);
    }
  }, [activosFijos, generateBulkQRLabels, toast]);

  const printQRLabels = useCallback(() => {
    if (!qrLabels.length) return;
    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Imprimir QRs</title>
          <style>
            @page { size: auto; margin: 0; }
            html, body { margin: 0; padding: 0; }
            .label { width: 50mm; height: 25mm; display: inline-block; page-break-inside: avoid; }
            .label img { width: 100%; height: 100%; }
          </style>
        </head>
        <body>
          ${qrLabels.map((l) => `<div class="label"><img src="${l.dataUrl}" /></div>`).join("")}
          <script>window.onload = function () { window.focus(); window.print(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [qrLabels]);

  const downloadQRsPDF = useCallback(() => {
    if (!qrLabels.length) return;
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: [50, 25],
    });
    qrLabels.forEach((l, i) => {
      if (i > 0) doc.addPage();
      doc.addImage(l.dataUrl, "PNG", 0, 0, 50, 25);
    });
    doc.save("codigos-qr.pdf");
  }, [qrLabels]);

  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
  }, []);
  const handlePageSizeChange = useCallback((newSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
  }, []);

  const handleAdd = useCallback(() => {
    setEditingActivo(null);
    setIsFormOpen(true);
  }, []);
  const handleEdit = useCallback((a) => {
    setEditingActivo(a);
    setIsFormOpen(true);
  }, []);
  const handleDelete = useCallback((a) => {
    setActivoToDelete(a);
    setIsDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!activoToDelete) return;
    dispatch(deleteActivoFijo(activoToDelete.codigoActivoInterno))
      .unwrap()
      .then(() => {
        setIsDeleteDialogOpen(false);
        setActivoToDelete(null);
        toast({
          title: "¡Éxito!",
          description: "El activo fijo se ha eliminado correctamente.",
        });
      })
      .catch((err) => {
        toast({
          title: "Error",
          description: `Fallo al eliminar: ${err.message || "Error desconocido"}`,
          variant: "destructive",
        });
      });
  }, [activoToDelete, dispatch, toast]);

  const handleCancel = useCallback(() => {
    setIsFormOpen(false);
    setEditingActivo(null);
  }, []);
  const handleFilterChange = useCallback((type, value) => {
    setFilters((p) => {
      const next = { ...p, [type]: value };
      if (type === "ciudad") {
        next.inmueble = "";
        next.nivel = "";
        next.ambiente = "";
      } else if (type === "inmueble") {
        next.nivel = "";
        next.ambiente = "";
      } else if (type === "nivel") {
        next.ambiente = "";
      }
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ ...INITIAL_FILTERS });
    setDebouncedSearch("");
    setDebouncedCarnet("");
    setCurrentPage(1);
    isFirstRender.current = true;
  }, [setFilters]);

  const handleSubmit = useCallback(
    async (data) => {
      const action = editingActivo
        ? updateActivoFijo({
            codigoActivoInterno: editingActivo.codigoActivoInterno,
            updatedActivoFijo: data,
          })
        : addActivoFijo(data);
      try {
        await dispatch(action).unwrap();
        toast({
          title: "¡Éxito!",
          description: `El activo fijo se ha ${editingActivo ? "actualizado" : "guardado"} correctamente.`,
        });
        handleCancel();
        return true;
      } catch (err) {
        toast({
          title: "Error",
          description: `Fallo al guardar: ${err.message || "Error desconocido"}`,
          variant: "destructive",
        });
        return false;
      }
    },
    [dispatch, editingActivo, toast, handleCancel],
  );

  if (isLoading && activosFijos.length === 0) return <LoadingSpinner />;
  if (error)
    return (
      <div className="bg-red-600 text-white text-center p-4 rounded-lg">
        Error: {error}
      </div>
    );

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Activos Fijos</h1>
          <p className="text-muted-foreground">
            Administra los activos fijos del sistema
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(filters.ciudad || filters.inmueble || filters.nivel || filters.ambiente) && (
            <Button
              variant="outline"
              onClick={handlePrintQRs}
              disabled={isGeneratingQrs || !activosFijos.length}
              className="bg-yellow-500 text-black hover:bg-yellow-600 hover:text-black"
            >
              <Printer className="mr-2 h-4 w-4" />
              {isGeneratingQrs ? "Generando..." : "Imprimir QRs"}
            </Button>
          )}
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleAdd}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo
              </Button>
            </DialogTrigger>
          <DialogContent
            className="sm:max-w-[700px]"
            onInteractOutside={(e) => {
              e.preventDefault();
              handleCancel();
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {editingActivo ? "Editar Activo Fijo" : "Nuevo Activo Fijo"}
              </DialogTitle>
              <DialogDescription>
                {editingActivo
                  ? "Modifica los datos del activo fijo"
                  : "Ingresa la información del nuevo activo fijo"}
              </DialogDescription>
            </DialogHeader>
            <ActivosFijosForm
              key={editingActivo?.codigoActivoInterno ?? "nuevo"}
              activoToEdit={editingActivo}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
            />
          </DialogContent>
        </Dialog>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Buscar</Label>
              <Input
                id="search"
                placeholder="Código activo, denominación..."
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="carnet">Carnet</Label>
              <Input
                id="carnet"
                placeholder="Buscar por CI..."
                value={filters.carnet}
                onChange={(e) => handleFilterChange("carnet", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <ComboboxField
                label="Rubro"
                value={filters.rubro}
                onValueChange={(val) => handleFilterChange("rubro", val)}
                options={rubroOptions}
                placeholder="Seleccionar rubro..."
                searchPlaceholder="Buscar rubro..."
                emptyMessage="Sin resultados"
              />
            </div>
            <div className="space-y-2">
              <ComboboxField
                label="Ciudad"
                value={filters.ciudad}
                onValueChange={(val) => handleFilterChange("ciudad", val)}
                options={ciudadOptions}
                placeholder="Seleccionar ciudad..."
                searchPlaceholder="Buscar ciudad..."
                emptyMessage="Sin resultados"
              />
            </div>
            <div className="space-y-2">
              <ComboboxField
                label="Inmueble"
                value={filters.inmueble}
                onValueChange={(val) => handleFilterChange("inmueble", val)}
                options={inmuebleOptionsByCiudad}
                placeholder="Seleccionar inmueble..."
                searchPlaceholder="Buscar inmueble..."
                emptyMessage="Sin resultados"
              />
            </div>
            <div className="space-y-2">
              <ComboboxField
                label="Nivel"
                value={filters.nivel}
                onValueChange={(val) => handleFilterChange("nivel", val)}
                options={nivelOptionsByInmueble}
                placeholder="Seleccionar nivel..."
                searchPlaceholder="Buscar nivel..."
                emptyMessage="Sin resultados"
              />
            </div>
            <div className="space-y-2">
              <ComboboxField
                label="Ambiente"
                value={filters.ambiente}
                onValueChange={(val) => handleFilterChange("ambiente", val)}
                options={ambienteOptionsByNivel}
                placeholder="Seleccionar ambiente..."
                searchPlaceholder="Buscar ambiente..."
                emptyMessage="Sin resultados"
              />
            </div>
            <div className="space-y-2 flex items-end">
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="w-full"
                disabled={!filters.search && !filters.rubro && !filters.carnet && !filters.ciudad && !filters.ambiente && !filters.inmueble && !filters.nivel}
              >
                <X className="mr-2 h-4 w-4" />
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
            Lista de Activos Fijos
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
                  <TableHead>Denominación</TableHead>
                  <TableHead>Valor Actual</TableHead>
                  <TableHead>Ambiente</TableHead>
                  <TableHead>Inmueble</TableHead>
                  <TableHead>Nivel</TableHead>
                  <TableHead>CI Responsable</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activosFijos.length > 0 ? (
                  activosFijos.map((a) => (
                    <TableRow key={a.codigoActivoInterno}>
                      <TableCell className="font-mono text-xs">
                        {a.codigoActivo != null ? `OJ-02-${a.codigoActivo}` : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs whitespace-normal break-words max-w-[180px]">
                        {rubroMap[a.tiporubroact] ??
                          rubroMap[a.tipoRubroAct] ??
                          "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {tipoRubroMap[a.tiporubroact] ??
                          tipoRubroMap[a.tipoRubroAct] ??
                          a.tiporubroact ??
                          a.tipoRubroAct ??
                          "—"}
                      </TableCell>
                      <TableCell className="whitespace-normal break-words max-w-[250px]">
                        {a.descripcionActivo}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {a.valorActual != null
                          ? `Bs ${Number(a.valorActual).toFixed(2)}`
                          : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs whitespace-normal break-words max-w-[180px]">
                        {ambienteMap[String(a.codigoAmbiente ?? a.codigoambiente).trim()] ??
                          a.ambiente ??
                          a.Ambiente ??
                          "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs whitespace-normal break-words max-w-[180px]">
                        {(() => {
                          const amb = String(a.codigoAmbiente ?? a.codigoambiente).trim();
                          if (!amb) return "—";
                          const codNivel = ambienteNivelMap[amb];
                          if (!codNivel) return "—";
                          const codInmueble = nivelInmuebleMap[String(codNivel).trim()];
                          if (!codInmueble) return "—";
                          return inmuebleMap[String(codInmueble).trim()] ?? "—";
                        })()}
                      </TableCell>
                      <TableCell className="font-mono text-xs whitespace-normal break-words max-w-[180px]">
                        {(() => {
                          const amb = String(a.codigoAmbiente ?? a.codigoambiente).trim();
                          if (!amb) return "—";
                          const codNivel = ambienteNivelMap[amb];
                          return codNivel ? (nivelMap[String(codNivel).trim()] ?? "—") : "—";
                        })()}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {a.cirun || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={a.estado === 1 ? "default" : "secondary"}
                        >
                          {ESTADO_MAP[a.estado] || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex space-x-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setBarcodeActivo(a)}
                            title="Código de barras"
                            className="text-green-600 hover:text-green-800"
                          >
                            <Barcode className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setQrActivo(a)}
                            title="Código QR"
                            className="text-purple-600 hover:text-purple-800"
                          >
                            <QrCode className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(a)}
                            title="Editar"
                            className="text-yellow-500 hover:text-yellow-700"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(a)}
                            title="Eliminar"
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={11}
                      className="text-center py-12 text-muted-foreground"
                    >
                      <Package className="mx-auto h-12 w-12 opacity-20 mb-2" />
                      <p className="text-lg font-medium">
                        {isLoading
                          ? "Cargando..."
                          : filters.search
                            ? "No se encontraron activos fijos"
                            : "No hay activos fijos registrados"}
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {totalCount > 0 && (
            <DataPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!barcodeActivo}
        onOpenChange={(open) => {
          if (!open) setBarcodeActivo(null);
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Código de Barras</DialogTitle>
            <DialogDescription>
              Activo: {formatCodigoActivo(barcodeActivo)} —{" "}
              {barcodeActivo?.descripcionActivo}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {barcodeDataUrl && (
              <div
                className="border rounded-lg p-4 bg-white"
                style={{ width: 260 }}
              >
                <img
                  src={barcodeDataUrl}
                  alt="Código de barras"
                  className="w-full"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBarcodeActivo(null)}>
              Cerrar
            </Button>
            <Button onClick={printBarcodePDF} disabled={!barcodeDataUrl}>
              <Barcode className="h-4 w-4 mr-2" />
              Descargar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!qrActivo}
        onOpenChange={(open) => {
          if (!open) setQrActivo(null);
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Código QR</DialogTitle>
            <DialogDescription>
              Activo: {formatCodigoActivo(qrActivo)} —{" "}
              {qrActivo?.descripcionActivo}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrDataUrl && (
              <div className="border rounded-lg p-1 bg-white w-full max-w-[360px]">
                <img src={qrDataUrl} alt="Código QR" className="w-full" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQrActivo(null)}>
              Cerrar
            </Button>
            <Button onClick={printQRPDF} disabled={!qrDataUrl}>
              <QrCode className="h-4 w-4 mr-2" />
              Descargar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isQrPrintOpen} onOpenChange={setIsQrPrintOpen}>
        <DialogContent className="sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle>Imprimir QRs ({qrLabels.length})</DialogTitle>
            <DialogDescription>
              Etiquetas generadas a partir de la lista actual. Listas para
              imprimir o descargar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-auto p-1">
            {qrLabels.map((l) => (
              <div
                key={l.codigoActivo}
                className="border rounded-lg overflow-hidden bg-white"
              >
                <img src={l.dataUrl} alt={l.codigoActivo} className="w-full" />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQrPrintOpen(false)}>
              Cerrar
            </Button>
            <Button onClick={downloadQRsPDF} disabled={!qrLabels.length}>
              <Download className="h-4 w-4 mr-2" />
              Descargar PDF
            </Button>
            <Button onClick={printQRLabels} disabled={!qrLabels.length}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              ¿Está seguro de eliminar este activo fijo?
            </DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. El activo fijo "
              {activoToDelete?.descripcionActivo}" será eliminado
              permanentemente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ActivosFijosList;
