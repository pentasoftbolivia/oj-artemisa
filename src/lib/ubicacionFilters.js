import { supabase } from "@/lib/supabase";

const NO_MATCH = [-1];

const fetchAmbientesByNivelCodes = async (nivelCodes) => {
  if (!nivelCodes || nivelCodes.length === 0) return NO_MATCH;
  const { data: ambientesByNivel } = await supabase
    .from("act_ambiente")
    .select("codigoambiente")
    .in("codigonivel", nivelCodes);
  const codes = (ambientesByNivel || []).map((a) => a.codigoambiente);
  return codes.length > 0 ? codes : NO_MATCH;
};

const fetchNivelesByInmuebleCodes = async (inmuebleCodes) => {
  if (!inmuebleCodes || inmuebleCodes.length === 0) return NO_MATCH;
  const { data: nivelesByInmueble } = await supabase
    .from("act_nivel")
    .select("codigonivel")
    .in("codigoinmueble", inmuebleCodes);
  return (nivelesByInmueble || []).map((n) => n.codigonivel);
};

/**
 * Resuelve la lista de codigos de ambiente que pertenecen a la ubicacion
 * seleccionada. Debido a la cascada de filtros, solo un nivel jerarquico
 * (ciudad | inmueble | nivel) puede estar activo a la vez.
 *
 * @returns {Promise<number[] | null>} Lista de codigos de ambiente o null si no hay filtro.
 */
export const resolveAmbienteCodes = async ({
  ciudad = "",
  inmueble = "",
  nivel = "",
} = {}) => {
  if (ciudad) {
    const { data: inmueblesByCiudad } = await supabase
      .from("act_inmueble")
      .select("codigoinmueble")
      .eq("codigociudad", ciudad);
    const inmuebleCodes = (inmueblesByCiudad || []).map((i) => i.codigoinmueble);
    const nivelCodes = await fetchNivelesByInmuebleCodes(inmuebleCodes);
    return fetchAmbientesByNivelCodes(nivelCodes);
  }

  if (inmueble) {
    const { data: nivelesByInmueble } = await supabase
      .from("act_nivel")
      .select("codigonivel")
      .eq("codigoinmueble", inmueble);
    const nivelCodes = (nivelesByInmueble || []).map((n) => n.codigonivel);
    return fetchAmbientesByNivelCodes(nivelCodes);
  }

  if (nivel) {
    const { data: ambientesByNivel } = await supabase
      .from("act_ambiente")
      .select("codigoambiente")
      .eq("codigonivel", nivel);
    const codes = (ambientesByNivel || []).map((a) => a.codigoambiente);
    return codes.length > 0 ? codes : NO_MATCH;
  }

  return null;
};
