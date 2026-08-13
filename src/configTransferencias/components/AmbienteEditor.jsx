import { memo, useMemo, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import ComboboxField from "@/components/ui/combobox-field";
import { Building2, Search, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCatalogos } from "@/hooks/useCatalogos";
import { createOptionsList } from "@/lib/utils";
import { findAmbiente } from "../services/transferenciaEditorService";

const EMPTY_SELECTION = { ciudad: "", inmueble: "", nivel: "", ambiente: "" };

const readOnlyHit = (label, codigo, descripcion) => (
  <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
    <p className="font-medium text-muted-foreground">{label}</p>
    <p className="font-mono font-semibold">
      {codigo != null ? String(codigo) : "—"}
    </p>
    <p className="truncate">{descripcion && String(descripcion).trim() ? String(descripcion).trim() : "—"}</p>
  </div>
);

const AmbienteEditor = memo(() => {
  const { toast } = useToast();
  const { ciudades, inmuebles, niveles, ambientes, isLoading } = useCatalogos({
    loadCiudades: true,
    loadInmuebles: true,
    loadNiveles: true,
    loadAmbientes: true,
  });

  const [selectionCiudad, setSelectionCiudad] = useState("");
  const [selectionInmueble, setSelectionInmueble] = useState("");
  const [selectionNivel, setSelectionNivel] = useState("");
  const [selectionAmbiente, setSelectionAmbiente] = useState("");

  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [searching, setSearching] = useState(false);

  const inmuebleCiudadMap = useMemo(() => {
    const map = {};
    (inmuebles || []).forEach((i) => {
      map[String(i.codigoinmueble).trim()] = String(i.codigociudad ?? "").trim();
    });
    return map;
  }, [inmuebles]);

  const nivelInmuebleMap = useMemo(() => {
    const map = {};
    (niveles || []).forEach((n) => {
      map[String(n.codigonivel).trim()] = String(n.codigoinmueble).trim();
    });
    return map;
  }, [niveles]);

  const ambienteNivelMap = useMemo(() => {
    const map = {};
    (ambientes || []).forEach((a) => {
      map[String(a.codigoambiente).trim()] = String(a.codigonivel ?? "").trim();
    });
    return map;
  }, [ambientes]);

  const ciudadOptions = useMemo(
    () => createOptionsList(ciudades || [], "codigociudad", "descripcion"),
    [ciudades],
  );

  const inmuebleOptionsByCiudad = useMemo(() => {
    const all = createOptionsList(inmuebles || [], "codigoinmueble", "inmueble");
    const ciudad = String(selectionCiudad).trim();
    if (!ciudad) return all;
    return all.filter((o) => inmuebleCiudadMap[String(o.value).trim()] === ciudad);
  }, [inmuebles, inmuebleCiudadMap, selectionCiudad]);

  const nivelOptionsByInmueble = useMemo(() => {
    const all = createOptionsList(niveles || [], "codigonivel", "nivel");
    const inmueble = String(selectionInmueble).trim();
    if (!inmueble) return all;
    return all.filter((o) => nivelInmuebleMap[String(o.value).trim()] === inmueble);
  }, [niveles, nivelInmuebleMap, selectionInmueble]);

  const ambienteOptionsByNivel = useMemo(() => {
    const all = createOptionsList(ambientes || [], "codigoambiente", "ambiente");
    const nivel = String(selectionNivel).trim();
    if (!nivel) return all;
    return all.filter((o) => ambienteNivelMap[String(o.value).trim()] === nivel);
  }, [ambientes, ambienteNivelMap, selectionNivel]);

  const handleSelect = (level, value) => {
    if (level === "ciudad") {
      setSelectionCiudad(value);
      setSelectionInmueble("");
      setSelectionNivel("");
      setSelectionAmbiente("");
    } else if (level === "inmueble") {
      setSelectionInmueble(value);
      setSelectionNivel("");
      setSelectionAmbiente("");
    } else if (level === "nivel") {
      setSelectionNivel(value);
      setSelectionAmbiente("");
    } else {
      setSelectionAmbiente(value);
    }
    setStatus("idle");
    setResult(null);
  };

  const handleSearch = useCallback(async () => {
    if (!selectionAmbiente) {
      toast({
        title: "Seleccione un ambiente",
        description: "Complete la cascada Ciudad → Inmueble → Nivel → Ambiente.",
        variant: "destructive",
      });
      return;
    }
    setSearching(true);
    setResult(null);
    try {
      const amb = await findAmbiente(selectionAmbiente);
      if (!amb) {
        setStatus("notfound");
        return;
      }
      const ambientKey = String(amb.codigoambiente).trim();
      const nivel = (niveles || []).find((n) =>
        String(n.codigonivel).trim() === String(amb.codigonivel ?? "").trim()
      );
      const inmueble = nivel
        ? (inmuebles || []).find((i) =>
          String(i.codigoinmueble).trim() === String(nivel.codigoinmueble ?? "").trim()
        )
        : undefined;
      const ciudad = inmueble
        ? (ciudades || []).find((c) =>
          String(c.codigociudad).trim() === String(inmueble.codigociudad ?? "").trim()
        )
        : undefined;

      setResult({
        ambientKey,
        ciudad,
        inmueble,
        nivel,
        ambiente: amb,
      });
      setStatus("found");
    } catch (err) {
      console.error("Error al buscar ambiente:", err);
      toast({
        title: "Error",
        description: `No se pudo buscar: ${err.message || "Error desconocido"}`,
        variant: "destructive",
      });
      setStatus("notfound");
    } finally {
      setSearching(false);
    }
  }, [selectionAmbiente, niveles, inmuebles, ciudades, toast]);

  const cascadaFields = [
    {
      level: "ciudad",
      label: "Ciudad",
      value: selectionCiudad,
      options: ciudadOptions,
      placeholder: "Seleccionar ciudad...",
    },
    {
      level: "inmueble",
      label: "Inmueble",
      value: selectionInmueble,
      options: inmuebleOptionsByCiudad,
      placeholder: "Seleccionar inmueble...",
    },
    {
      level: "nivel",
      label: "Nivel",
      value: selectionNivel,
      options: nivelOptionsByInmueble,
      placeholder: "Seleccionar nivel...",
    },
    {
      level: "ambiente",
      label: "Ambiente",
      value: selectionAmbiente,
      options: ambienteOptionsByNivel,
      placeholder: "Seleccionar ambiente...",
    },
  ];

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4" />
          Ambientes
        </CardTitle>
        <CardDescription>
          Búsqueda en cascada por ciudad, inmueble, nivel y ambiente
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 flex-1">
        <div className="space-y-3">
          {cascadaFields.map((f) => (
            <div key={f.level} className="space-y-1.5">
              <Label>{f.label}</Label>
              <ComboboxField
                value={f.value}
                onValueChange={(val) => handleSelect(f.level, val)}
                options={f.options}
                placeholder={f.placeholder}
                searchPlaceholder={`Buscar ${f.label.toLowerCase()}...`}
                emptyMessage="Sin resultados"
                loading={isLoading}
                disabled={searching}
              />
            </div>
          ))}
        </div>

        <Button onClick={handleSearch} disabled={searching}>
          {searching ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Search className="h-4 w-4 mr-2" />
          )}
          Buscar
        </Button>

        {status === "loading" ? (
          <div className="text-sm text-muted-foreground animate-pulse py-6 text-center">
            Buscando...
          </div>
        ) : status === "notfound" ? (
          <div className="text-center text-sm text-muted-foreground py-6 border rounded-md">
            No se encontró el ambiente
          </div>
        ) : status === "found" && result ? (
          <div className="grid gap-2">
            <div className="grid grid-cols-2 gap-2">
              {result.ciudad && readOnlyHit("Ciudad", result.ciudad.codigociudad, result.ciudad.descripcion)}
              {result.inmueble && readOnlyHit("Inmueble", result.inmueble.codigoinmueble, result.inmueble.inmueble)}
              {result.nivel && readOnlyHit("Nivel", result.nivel.codigonivel, result.nivel.nivel)}
              {result.ambiente && readOnlyHit("Ambiente", result.ambiente.codigoambiente, result.ambiente.ambiente)}
            </div>
          </div>
        ) : (
          <div className="text-center text-sm text-muted-foreground py-6 border rounded-md">
            Complete la cascada y presione Buscar
          </div>
        )}
      </CardContent>
    </Card>
  );
});

AmbienteEditor.displayName = "AmbienteEditor";
export default AmbienteEditor;