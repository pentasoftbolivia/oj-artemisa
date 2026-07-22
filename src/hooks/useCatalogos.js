import { useState, useEffect } from "react";
import { getCatalogos } from "@/services/catalogosService";

/**
 * Module-level cache for catalogue data.
 * Persists across component instances to avoid redundant fetches.
 */
const catalogosCache = new Map();

/**
 * Custom hook to fetch multiple catalogue tables asynchronously.
 * Results are cached by (table + columns) combination.
 * 
 * @param {Array<{table: string, columns?: string}>} catalogosToFetch 
 * @returns {{ data: Object, loading: boolean, error: string|null }}
 */
export const useCatalogos = (catalogosToFetch = []) => {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const cacheKey = JSON.stringify(catalogosToFetch);

    const fetchCatalogos = async () => {
      if (catalogosToFetch.length === 0) {
        setLoading(false);
        return;
      }

      const cached = catalogosCache.get(cacheKey);
      if (cached) {
        if (isMounted) {
          setData(cached.data);
          setLoading(false);
          setError(null);
        }
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await getCatalogos(catalogosToFetch);
        catalogosCache.set(cacheKey, { data: result });
        if (isMounted) {
          setData(result);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Error al cargar catálogos");
          console.error("Error fetching catalogos:", err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchCatalogos();

    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  return { data, loading, error };
};
