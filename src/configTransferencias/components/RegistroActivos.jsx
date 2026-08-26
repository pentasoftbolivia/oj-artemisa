import { useState, useMemo, useEffect } from "react";
import { useSelector } from "react-redux";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ComboboxField from "@/components/ui/combobox-field";
import { Loader2, Save, PackagePlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCatalogos } from "@/hooks/useCatalogos";
import { createOptionsList } from "@/lib/utils";
import { selectUser } from "@/store/auth/authSlice";
import { crearRegistroActivo } from "../services/registroActivoService";

const RegistroActivos = ({ onSuccess }) => {
  const { toast } = useToast();
  const currentUser = useSelector(selectUser);
  const userEmail = currentUser?.email || "";

  const { rubros, tipoRubros, ciudades, inmuebles, niveles, ambientes, responsables, isLoading } = useCatalogos({
    loadRubros: true,
    loadTipoRubros: true,
    loadCiudades: true,
    loadInmuebles: true,
    loadNiveles: true,
    loadAmbientes: true,
    loadResponsables: true,
  });

  // Form state
  const [codigoActivo, setCodigoActivo] = useState("");
  const [descripcionActivo, setDescripcionActivo] = useState("");
  const [valorActual, setValorActual] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [serie, setSerie] = useState("");
  const [marcaMaterial, setMarcaMaterial] = useState("");

  // Rubro / TipoRubro
  const [rubroSel, setRubroSel] = useState("");
  const [tipoRubroSel, setTipoRubroSel] = useState("");

  // Ubicación cascada
  const [selCiudad, setSelCiudad] = useState("");
  const [selInmueble, setSelInmueble] = useState("");
  const [selNivel, setSelNivel] = useState("");
  const [selAmbiente, setSelAmbiente] = useState("");

  // Responsable
  const [cirun, setCirun] = useState("");

  const [saving, setSaving] = useState(false);
  const [ultimoCodigo, setUltimoCodigo] = useState(null);

  useEffect(() => {
    const fetchUltimo = async () => {
      try {
        const { data, error } = await supabase
          .from("act_activos")
          .select("codigoactivo")
          .eq("ultimoregistro", 1)
          .order("codigoactivo", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!error && data?.codigoactivo != null) {
          setUltimoCodigo(Number(data.codigoactivo));
        }
      } catch (_) { }
    };
    fetchUltimo();
  }, []);

  // Maps para cascada
  const inmuebleCiudadMap = useMemo(() => {
    const m = {};
    (inmuebles || []).forEach((i) => { m[String(i.codigoinmueble).trim()] = String(i.codigociudad ?? "").trim(); });
    return m;
  }, [inmuebles]);
  const nivelInmuebleMap = useMemo(() => {
    const m = {};
    (niveles || []).forEach((n) => { m[String(n.codigonivel).trim()] = String(n.codigoinmueble).trim(); });
    return m;
  }, [niveles]);
  const ambienteNivelMap = useMemo(() => {
    const m = {};
    (ambientes || []).forEach((a) => { m[String(a.codigoambiente).trim()] = String(a.codigonivel ?? "").trim(); });
    return m;
  }, [ambientes]);

  const ciudadOptions = useMemo(() => createOptionsList(ciudades || [], "codigociudad", "descripcion"), [ciudades]);
  const inmuebleOptionsByCiudad = useMemo(() => {
    const all = createOptionsList(inmuebles || [], "codigoinmueble", "inmueble");
    const c = String(selCiudad).trim();
    if (!c) return all;
    return all.filter((o) => inmuebleCiudadMap[String(o.value).trim()] === c);
  }, [inmuebles, inmuebleCiudadMap, selCiudad]);
  const nivelOptionsByInmueble = useMemo(() => {
    const all = createOptionsList(niveles || [], "codigonivel", "nivel");
    const im = String(selInmueble).trim();
    if (!im) return all;
    return all.filter((o) => nivelInmuebleMap[String(o.value).trim()] === im);
  }, [niveles, nivelInmuebleMap, selInmueble]);
  const ambienteOptionsByNivel = useMemo(() => {
    const all = createOptionsList(ambientes || [], "codigoambiente", "ambiente");
    const nv = String(selNivel).trim();
    if (!nv) return all;
    return all.filter((o) => ambienteNivelMap[String(o.value).trim()] === nv);
  }, [ambientes, ambienteNivelMap, selNivel]);

  const rubroOptions = useMemo(() => {
    const opts = createOptionsList(rubros || [], "codigorubroact", "descripcionrubroact");
    return [...opts].sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));
  }, [rubros]);
  const tipoRubroOptionsFiltered = useMemo(() => {
    const all = tipoRubros || [];
    const base = rubroSel ? all.filter((t) => String(t.codigorubroact) === String(rubroSel)) : all;
    const opts = createOptionsList(base, "tiporubroact", "descripciontiporubroact");
    return [...opts].sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));
  }, [tipoRubros, rubroSel]);

  const responsableOptions = useMemo(() => {
    const opts = (responsables || []).map((r) => {
      const nombre = [r.nombre1, r.nombre2, r.paterno, r.materno].filter(Boolean).join(" ").trim() || r.cirun;
      return { value: String(r.cirun).trim(), label: `${nombre} (${r.cirun})` };
    });
    return [...opts].sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));
  }, [responsables]);

  const handleSelectUbicacion = (level, value) => {
    if (level === "ciudad") { setSelCiudad(value); setSelInmueble(""); setSelNivel(""); setSelAmbiente(""); }
    else if (level === "inmueble") { setSelInmueble(value); setSelNivel(""); setSelAmbiente(""); }
    else if (level === "nivel") { setSelNivel(value); setSelAmbiente(""); }
    else setSelAmbiente(value);
  };

  const handleRubroChange = (val) => {
    setRubroSel(val);
    setTipoRubroSel("");
  };

  const resetForm = () => {
    setCodigoActivo(""); setDescripcionActivo(""); setValorActual(""); setObservaciones(""); setSerie(""); setMarcaMaterial("");
    setRubroSel(""); setTipoRubroSel(""); setSelCiudad(""); setSelInmueble(""); setSelNivel(""); setSelAmbiente(""); setCirun("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;
    setSaving(true);
    try {
      const result = await crearRegistroActivo({
        codigoactivo: codigoActivo,
        codigoambiente: selAmbiente,
        cirun,
        descripcionactivo: descripcionActivo,
        valoractual: valorActual,
        observaciones,
        tiporubroact: tipoRubroSel,
        serie,
        marcamaterial: marcaMaterial,
        userEmail,
      });
      toast({ title: "¡Éxito!", description: `Activo ${result.activo.codigoactivo} registrado (Transacción ${result.transaccion.codigotransaccion})` });
      const nuevo = Number(codigoActivo);
      if (!Number.isNaN(nuevo) && (ultimoCodigo == null || nuevo > ultimoCodigo)) setUltimoCodigo(nuevo);
      resetForm();
      if (onSuccess) onSuccess();
    } catch (err) {
      toast({ title: "Error", description: err.message || "Error al registrar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const isSubmitDisabled = saving || isLoading || !codigoActivo.trim() || !descripcionActivo.trim() || !valorActual.toString().trim() || !selAmbiente || !cirun || !tipoRubroSel;

  return (
    <Card className="border-t-4 border-t-yellow-500">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <PackagePlus className="h-4 w-4" />
          Datos importantes del Activo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identificación */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ra-codigoactivo">Código Activo *</Label>
              <Input
                id="ra-codigoactivo"
                type="number"
                value={codigoActivo}
                onChange={(e) => setCodigoActivo(e.target.value)}
                placeholder={ultimoCodigo != null ? `Ej: ${ultimoCodigo + 1} (último: ${ultimoCodigo})` : "Ej: 45000"}
                disabled={saving}
              />
              {ultimoCodigo != null && (
                <p className="text-xs text-muted-foreground">
                  Último registro: <span className="font-mono font-semibold">{ultimoCodigo}</span> — sugerido: <span className="font-mono">{ultimoCodigo + 1}</span>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Rubro *</Label>
              <ComboboxField
                value={rubroSel}
                onValueChange={handleRubroChange}
                options={rubroOptions}
                placeholder="Seleccionar rubro..."
                searchPlaceholder="Buscar rubro..."
                emptyMessage="Sin resultados"
                loading={isLoading}
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo Rubro *</Label>
              <ComboboxField
                value={tipoRubroSel}
                onValueChange={setTipoRubroSel}
                options={tipoRubroOptionsFiltered}
                placeholder={rubroSel ? "Seleccionar tipo..." : "Seleccione rubro primero"}
                searchPlaceholder="Buscar tipo de rubro..."
                emptyMessage="Sin resultados"
                loading={isLoading}
                disabled={saving || !rubroSel}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ra-descripcion">Descripción Activo *</Label>
              <Input id="ra-descripcion" value={descripcionActivo} onChange={(e) => setDescripcionActivo(e.target.value)} placeholder="Descripción del activo" disabled={saving} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ra-valoractual">Valor Actual *</Label>
              <Input id="ra-valoractual" type="number" step="0.01" value={valorActual} onChange={(e) => setValorActual(e.target.value)} placeholder="Ej: 1500.00" disabled={saving} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ra-serie">Serie</Label>
              <Input id="ra-serie" value={serie} onChange={(e) => setSerie(e.target.value)} placeholder="Serie" disabled={saving} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ra-marca">Marca / Material</Label>
              <Input id="ra-marca" value={marcaMaterial} onChange={(e) => setMarcaMaterial(e.target.value)} placeholder="Marca" disabled={saving} />
            </div>
            <div className="space-y-1.5">
              <Label>Responsable (CI) *</Label>
              <ComboboxField value={cirun} onValueChange={setCirun} options={responsableOptions} placeholder="Buscar responsable..." searchPlaceholder="Buscar por nombre o CI..." emptyMessage="Sin resultados" loading={isLoading} disabled={saving} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ra-observaciones">Observaciones</Label>
            <Textarea id="ra-observaciones" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Observaciones..." rows={2} disabled={saving} />
          </div>

          {/* Ubicación en cascada */}
          <div className="rounded-lg border p-4 bg-muted/20 space-y-3">
            <p className="text-sm font-semibold">Ubicación — Código Ambiente *</p>
            <p className="text-xs text-muted-foreground">Seleccion en cascada </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label>Ciudad</Label>
                <ComboboxField value={selCiudad} onValueChange={(v) => handleSelectUbicacion("ciudad", v)} options={ciudadOptions} placeholder="Ciudad..." searchPlaceholder="Buscar ciudad..." emptyMessage="Sin resultados" loading={isLoading} disabled={saving} />
              </div>
              <div className="space-y-1.5">
                <Label>Inmueble</Label>
                <ComboboxField value={selInmueble} onValueChange={(v) => handleSelectUbicacion("inmueble", v)} options={inmuebleOptionsByCiudad} placeholder="Inmueble..." searchPlaceholder="Buscar inmueble..." emptyMessage="Sin resultados" loading={isLoading} disabled={saving} />
              </div>
              <div className="space-y-1.5">
                <Label>Nivel</Label>
                <ComboboxField value={selNivel} onValueChange={(v) => handleSelectUbicacion("nivel", v)} options={nivelOptionsByInmueble} placeholder="Nivel..." searchPlaceholder="Buscar nivel..." emptyMessage="Sin resultados" loading={isLoading} disabled={saving} />
              </div>
              <div className="space-y-1.5">
                <Label>Ambiente *</Label>
                <ComboboxField value={selAmbiente} onValueChange={(v) => handleSelectUbicacion("ambiente", v)} options={ambienteOptionsByNivel} placeholder="Ambiente..." searchPlaceholder="Buscar ambiente..." emptyMessage="Sin resultados" loading={isLoading} disabled={saving} />
              </div>
            </div>
            {selAmbiente && <p className="text-xs text-muted-foreground">Código ambiente seleccionado: <span className="font-mono font-semibold">{selAmbiente}</span></p>}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>Limpiar</Button>
            <Button type="submit" disabled={isSubmitDisabled} className="bg-yellow-500 hover:bg-yellow-600 text-white">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Registrar Activo
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Campos con * obligatorios. Estado=1, ultimoregistro=1.</p>
        </form>
      </CardContent>
    </Card>
  );
};

export default RegistroActivos;
