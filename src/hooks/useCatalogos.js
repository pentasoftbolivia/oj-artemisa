import { useState, useEffect } from "react";
import { getCachedCatalog } from "@/lib/catalogCache";

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
          promises.push(getCachedCatalog("act_rubro"));
          keys.push("rubros");
        }
        if (loadTipoRubros) {
          promises.push(getCachedCatalog("act_tiporubro"));
          keys.push("tipoRubros");
        }
        if (loadAmbientes) {
          promises.push(getCachedCatalog("act_ambiente"));
          keys.push("ambientes");
        }
        if (loadResponsables) {
          promises.push(getCachedCatalog("act_responsable"));
          keys.push("responsables");
        }
        if (loadInmuebles) {
          promises.push(getCachedCatalog("act_inmueble"));
          keys.push("inmuebles");
        }
        if (loadNiveles) {
          promises.push(getCachedCatalog("act_nivel"));
          keys.push("niveles");
        }
        if (loadCiudades) {
          promises.push(getCachedCatalog("act_ciudad"));
          keys.push("ciudades");
        }

        const results = await Promise.all(promises);
        if (!isMounted) return;

        const newCatalogos = {};
        results.forEach((res, index) => {
          newCatalogos[keys[index]] = res || [];
        });

        if (loadAmbientes) {
          newCatalogos.ambienteNivel = (newCatalogos.ambientes || []).map((a) => ({
            codigoambiente: a.codigoambiente,
            codigonivel: a.codigonivel,
          }));
        }

        setCatalogos((prev) => ({ ...prev, ...newCatalogos }));
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
