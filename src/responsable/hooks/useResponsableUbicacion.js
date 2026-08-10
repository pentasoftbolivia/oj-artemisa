import { useMemo } from "react";
import { useCatalogos } from "@/hooks/useCatalogos";
import { createOptionsList } from "@/lib/utils";

export const useResponsableUbicacion = (filters = {}) => {
  const {
    ambientes,
    inmuebles,
    niveles,
    ciudades,
    isLoading,
  } = useCatalogos({
    loadAmbientes: true,
    loadInmuebles: true,
    loadNiveles: true,
    loadCiudades: true,
  });

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
      map[String(a.codigoambiente).trim()] = a.codigonivel;
    });
    return map;
  }, [ambientes]);

  const ciudadOptions = useMemo(
    () => createOptionsList(ciudades || [], "codigociudad", "descripcion"),
    [ciudades],
  );

  const inmuebleOptionsByCiudad = useMemo(() => {
    const all = createOptionsList(inmuebles || [], "codigoinmueble", "inmueble");
    const ciudad = String(filters.ciudad ?? "").trim();
    if (!ciudad) return all;
    return all.filter(
      (o) => String(inmuebleCiudadMap[String(o.value).trim()] ?? "").trim() === ciudad,
    );
  }, [inmuebles, inmuebleCiudadMap, filters?.ciudad]);

  const nivelOptionsByInmueble = useMemo(() => {
    const all = createOptionsList(niveles || [], "codigonivel", "nivel");
    const inmueble = String(filters.inmueble ?? "").trim();
    if (!inmueble) return all;
    return all.filter(
      (o) => String(nivelInmuebleMap[String(o.value).trim()] ?? "").trim() === inmueble,
    );
  }, [niveles, nivelInmuebleMap, filters?.inmueble]);

  const ambienteOptionsByNivel = useMemo(() => {
    const all = createOptionsList(ambientes || [], "codigoambiente", "ambiente");
    const nivel = String(filters.nivel ?? "").trim();
    if (!nivel) return all;
    return all.filter(
      (o) => String(ambienteNivelMap[String(o.value).trim()] ?? "").trim() === nivel,
    );
  }, [ambientes, ambienteNivelMap, filters?.nivel]);

  return {
    ciudadOptions,
    inmuebleOptionsByCiudad,
    nivelOptionsByInmueble,
    ambienteOptionsByNivel,
    isLoading,
  };
};
