import { useMemo } from "react";
import { createOptionsList } from "@/lib/utils";

/**
 * Construye las opciones de la cascada Ciudad -> Inmueble -> Nivel -> Ambiente
 * y las restringe segun la seleccion del filtro padre.
 */
export const useUbicacionOptions = ({
  ciudades = [],
  inmuebles = [],
  niveles = [],
  ambientes = [],
  filters = {},
}) => {
  const filterEliminar = (opts) => opts.filter((o) => !String(o.label).toUpperCase().includes("(ELIMINAR)"));

  const ciudadOptions = useMemo(
    () => filterEliminar(createOptionsList(ciudades, "codigociudad", "descripcion")),
    [ciudades],
  );

  const inmuebleOptions = useMemo(
    () => filterEliminar(createOptionsList(inmuebles, "codigoinmueble", "inmueble")),
    [inmuebles],
  );

  const nivelOptions = useMemo(
    () => filterEliminar(createOptionsList(niveles, "codigonivel", "nivel")),
    [niveles],
  );

  const ambienteOptions = useMemo(
    () => filterEliminar(createOptionsList(ambientes, "codigoambiente", "ambiente")),
    [ambientes],
  );

  const inmuebleCiudadMap = useMemo(() => {
    const map = {};
    inmuebles.forEach((i) => {
      map[String(i.codigoinmueble).trim()] = String(i.codigociudad ?? "").trim();
    });
    return map;
  }, [inmuebles]);

  const nivelInmuebleMap = useMemo(() => {
    const map = {};
    niveles.forEach((n) => {
      map[String(n.codigonivel).trim()] = String(n.codigoinmueble).trim();
    });
    return map;
  }, [niveles]);

  const ambienteNivelMap = useMemo(() => {
    const map = {};
    ambientes.forEach((a) => {
      map[String(a.codigoambiente).trim()] = a.codigonivel;
    });
    return map;
  }, [ambientes]);

  const inmuebleOptionsByCiudad = useMemo(() => {
    const ciudad = String(filters.ciudad ?? "").trim();
    if (!ciudad) return inmuebleOptions;
    return inmuebleOptions.filter(
      (o) => inmuebleCiudadMap[String(o.value).trim()] === ciudad,
    );
  }, [inmuebleOptions, inmuebleCiudadMap, filters.ciudad]);

  const nivelOptionsByInmueble = useMemo(() => {
    const inmueble = String(filters.inmueble ?? "").trim();
    const ciudad = String(filters.ciudad ?? "").trim();
    if (inmueble) {
      return nivelOptions.filter(
        (o) => nivelInmuebleMap[String(o.value).trim()] === inmueble,
      );
    }
    if (ciudad) {
      const inmuebleCodesInCiudad = new Set(
        Object.entries(inmuebleCiudadMap)
          .filter(([, c]) => c === ciudad)
          .map(([inm]) => inm),
      );
      return nivelOptions.filter((o) => inmuebleCodesInCiudad.has(nivelInmuebleMap[String(o.value).trim()]));
    }
    return nivelOptions;
  }, [nivelOptions, nivelInmuebleMap, inmuebleCiudadMap, filters.inmueble, filters.ciudad]);

  const ambienteOptionsByNivel = useMemo(() => {
    const nivel = String(filters.nivel ?? "").trim();
    const inmueble = String(filters.inmueble ?? "").trim();
    const ciudad = String(filters.ciudad ?? "").trim();
    if (nivel) {
      return ambienteOptions.filter(
        (o) => String(ambienteNivelMap[String(o.value).trim()] ?? "") === nivel,
      );
    }
    if (inmueble) {
      const nivelCodesInInmueble = new Set(
        Object.entries(nivelInmuebleMap)
          .filter(([, inm]) => inm === inmueble)
          .map(([niv]) => niv),
      );
      return ambienteOptions.filter((o) => nivelCodesInInmueble.has(String(ambienteNivelMap[String(o.value).trim()] ?? "")));
    }
    if (ciudad) {
      const inmuebleCodesInCiudad = new Set(
        Object.entries(inmuebleCiudadMap)
          .filter(([, c]) => c === ciudad)
          .map(([inm]) => inm),
      );
      const nivelCodesInCiudad = new Set(
        Object.entries(nivelInmuebleMap)
          .filter(([, inm]) => inmuebleCodesInCiudad.has(inm))
          .map(([niv]) => niv),
      );
      return ambienteOptions.filter((o) => nivelCodesInCiudad.has(String(ambienteNivelMap[String(o.value).trim()] ?? "")));
    }
    return ambienteOptions;
  }, [ambienteOptions, ambienteNivelMap, nivelInmuebleMap, inmuebleCiudadMap, filters.nivel, filters.inmueble, filters.ciudad]);

  return {
    ciudadOptions,
    inmuebleOptions,
    nivelOptions,
    ambienteOptions,
    inmuebleCiudadMap,
    nivelInmuebleMap,
    ambienteNivelMap,
    inmuebleOptionsByCiudad,
    nivelOptionsByInmueble,
    ambienteOptionsByNivel,
  };
};
