import { useState, useEffect } from "react";
import { supabase, fetchAllFromTable } from "@/lib/supabase";

export const useCatalogos = (options = {}) => {
  const {
    loadRubros = false,
    loadTipoRubros = false,
    loadAmbientes = false,
    loadResponsables = false,
    loadInmuebles = false,
    loadNiveles = false,
    loadCiudades = false,
  } = options;

  const [catalogos, setCatalogos] = useState({
    rubros: [],
    tipoRubros: [],
    ambientes: [],
    ambienteNivel: [],
    responsables: [],
    inmuebles: [],
    niveles: [],
    ciudades: [],
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    
    const fetchCatalogos = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const promises = [];
        const keys = [];

        if (loadRubros) {
          promises.push(supabase.from("act_rubro").select("codigorubroact, descripcionrubroact").order("descripcionrubroact", { ascending: true }));
          keys.push("rubros");
        }
        if (loadTipoRubros) {
          promises.push(supabase.from("act_tiporubro").select("tiporubroact, descripciontiporubroact, codigorubroact").order("descripciontiporubroact", { ascending: true }));
          keys.push("tipoRubros");
        }
        if (loadAmbientes) {
          promises.push(fetchAllFromTable("act_ambiente", "codigoambiente, ambiente, codigonivel", { orderColumn: "ambiente", ascending: true }));
          keys.push("ambientes");
        }
        if (loadResponsables) {
          promises.push(fetchAllFromTable("act_responsable", "*", { orderColumn: "cirun", ascending: true }));
          keys.push("responsables");
        }
        if (loadInmuebles) {
          promises.push(supabase.from("act_inmueble").select("codigoinmueble, inmueble, codigociudad").order("inmueble", { ascending: true }));
          keys.push("inmuebles");
        }
        if (loadNiveles) {
          promises.push(supabase.from("act_nivel").select("codigonivel, nivel, codigoinmueble").order("nivel", { ascending: true }));
          keys.push("niveles");
        }
        if (loadCiudades) {
          promises.push(supabase.from("act_ciudad").select("codigociudad, descripcion").order("descripcion", { ascending: true }));
          keys.push("ciudades");
        }

        const results = await Promise.all(promises);
        
        if (!isMounted) return;

        const newCatalogos = { ...catalogos };
        results.forEach((res, index) => {
          const key = keys[index];
          // For supabase.from().select() promises, they return { data, error }
          // For fetchAllFromTable, it returns the array directly
          if (res && res.data !== undefined) {
            if (res.error) throw res.error;
            newCatalogos[key] = res.data || [];
          } else {
            newCatalogos[key] = res || [];
          }
        });

        if (loadAmbientes) {
           newCatalogos.ambienteNivel = newCatalogos.ambientes.map(a => ({ codigoambiente: a.codigoambiente, codigonivel: a.codigonivel }));
        }

        setCatalogos(prev => ({ ...prev, ...newCatalogos }));
      } catch (err) {
        if (isMounted) setError(err);
        console.error("Error fetching catalogos:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchCatalogos();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ...catalogos, isLoading, error };
};
