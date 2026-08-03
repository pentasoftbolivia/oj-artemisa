import { useMemo } from "react";
import { createOptionsList } from "@/lib/utils";

export const useActivosFijosCatalogs = ({
  rubros,
  tipoRubros,
  ambientes,
  ambienteNivel,
  inmuebles,
  niveles,
  ciudades,
  filters,
}) => {
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
      map[String(a.codigoambiente).trim()] = (a.ambiente || "").trim();
    });
    return map;
  }, [ambientes]);

  const ambienteNivelMap = useMemo(() => {
    const map = {};
    (ambienteNivel || []).forEach((a) => {
      map[String(a.codigoambiente).trim()] = a.codigonivel;
    });
    return map;
  }, [ambienteNivel]);

  const nivelMap = useMemo(() => {
    const map = {};
    (niveles || []).forEach((n) => {
      map[String(n.codigonivel).trim()] = (n.nivel || "").trim();
    });
    return map;
  }, [niveles]);

  const nivelInmuebleMap = useMemo(() => {
    const map = {};
    (niveles || []).forEach((n) => {
      map[String(n.codigonivel).trim()] = String(n.codigoinmueble).trim();
    });
    return map;
  }, [niveles]);

  const inmuebleMap = useMemo(() => {
    const map = {};
    (inmuebles || []).forEach((i) => {
      map[String(i.codigoinmueble).trim()] = (i.inmueble || "").trim();
    });
    return map;
  }, [inmuebles]);

  const inmuebleCiudadMap = useMemo(() => {
    const map = {};
    (inmuebles || []).forEach((i) => {
      map[String(i.codigoinmueble).trim()] = String(i.codigociudad ?? "").trim();
    });
    return map;
  }, [inmuebles]);

  const ciudadMap = useMemo(() => {
    const map = {};
    (ciudades || []).forEach((c) => {
      map[String(c.codigociudad).trim()] = (c.descripcion || "").trim();
    });
    return map;
  }, [ciudades]);

  const tipoRubroMap = useMemo(() => {
    const map = {};
    (tipoRubros || []).forEach((t) => {
      map[t.tiporubroact] = t.descripciontiporubroact;
      map[String(t.tiporubroact)] = t.descripciontiporubroact;
    });
    return map;
  }, [tipoRubros]);

  const rubroOptions = useMemo(() => createOptionsList(rubros || [], "codigorubroact", "descripcionrubroact"), [rubros]);
  const ciudadOptions = useMemo(() => createOptionsList(ciudades || [], "codigociudad", "descripcion"), [ciudades]);
  const ambienteOptions = useMemo(() => createOptionsList(ambientes || [], "codigoambiente", "ambiente"), [ambientes]);
  const inmuebleOptions = useMemo(() => createOptionsList(inmuebles || [], "codigoinmueble", "inmueble"), [inmuebles]);
  const nivelOptions = useMemo(() => createOptionsList(niveles || [], "codigonivel", "nivel"), [niveles]);

  const inmuebleOptionsByCiudad = useMemo(() => {
    if (!filters?.ciudad) return inmuebleOptions;
    const ciudad = String(filters.ciudad).trim();
    return inmuebleOptions.filter((o) => inmuebleCiudadMap[String(o.value).trim()] === ciudad);
  }, [inmuebleOptions, inmuebleCiudadMap, filters?.ciudad]);

  const nivelOptionsByInmueble = useMemo(() => {
    if (!filters?.inmueble) return nivelOptions;
    const inmueble = String(filters.inmueble).trim();
    return nivelOptions.filter((o) => nivelInmuebleMap[String(o.value).trim()] === inmueble);
  }, [nivelOptions, nivelInmuebleMap, filters?.inmueble]);

  const ambienteOptionsByNivel = useMemo(() => {
    if (!filters?.nivel) return ambienteOptions;
    const nivel = String(filters.nivel).trim();
    return ambienteOptions.filter((o) => String(ambienteNivelMap[String(o.value).trim()] ?? "") === nivel);
  }, [ambienteOptions, ambienteNivelMap, filters?.nivel]);

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

  return {
    rubroMap,
    ambienteMap,
    ambienteNivelMap,
    nivelMap,
    nivelInmuebleMap,
    inmuebleMap,
    inmuebleCiudadMap,
    ciudadMap,
    tipoRubroMap,
    rubroOptions,
    ciudadOptions,
    inmuebleOptionsByCiudad,
    nivelOptionsByInmueble,
    ambienteOptionsByNivel,
    rubroToTipoIds,
  };
};
