import { useEffect, useState } from "react";
import { fetchActivoImages } from "../services/inventarioService";

/**
 * Conteos de fotos sin bloquear la tabla.
 * - La tabla renderiza de inmediato con "…" .
 * - Los conteos se piden DESPUÉS del paint (requestIdleCallback / setTimeout),
 *   con concurrencia limitada (6) y cancelación al cambiar de página.
 * - Usa photoCountsRef como caché global entre páginas/modales.
 */
export const usePhotoCounts = (paginatedData, photoCountsRef, concurrency = 6) => {
  const [photoCounts, setPhotoCounts] = useState(() => ({ ...photoCountsRef.current }));

  useEffect(() => {
    let cancelled = false;
    const items = (paginatedData || []).filter((a) => {
      const key = String(a.codigoActivo);
      return photoCountsRef.current[key] === undefined;
    });
    if (items.length === 0) {
      // Sincronizar con caché por si se actualizó desde el modal
      setPhotoCounts((prev) => {
        const cached = photoCountsRef.current;
        let same = Object.keys(cached).length === Object.keys(prev).length;
        if (same) {
          for (const k of Object.keys(cached)) {
            if (cached[k] !== prev[k]) { same = false; break; }
          }
        }
        return same ? prev : { ...cached };
      });
      return undefined;
    }

    const run = async () => {
      // Esperar al paint + idle para no competir con la tabla
      await new Promise((r) => {
        if (typeof window !== "undefined" && "requestIdleCallback" in window) {
          window.requestIdleCallback(() => r(), { timeout: 800 });
        } else {
          setTimeout(r, 50);
        }
      });
      if (cancelled) return;

      const next = { ...photoCountsRef.current };
      // Procesar en lotes para limitar concurrencia y re-renders
      for (let i = 0; i < items.length && !cancelled; i += concurrency) {
        const chunk = items.slice(i, i + concurrency);
        const results = await Promise.all(
          chunk.map(async (a) => {
            const key = String(a.codigoActivo);
            try {
              const files = await fetchActivoImages(a.codigoActivo);
              return [key, files.length];
            } catch {
              return [key, 0];
            }
          }),
        );
        if (cancelled) return;
        results.forEach(([key, count]) => {
          next[key] = count;
        });
        photoCountsRef.current = { ...next };
        setPhotoCounts({ ...next });
      }
    };

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginatedData]);

  /** Actualiza el conteo de UN activo (al abrir modal / subir foto). */
  const refreshOne = async (codigoActivo, count) => {
    const key = String(codigoActivo);
    let value = count;
    if (value === undefined) {
      try {
        const files = await fetchActivoImages(codigoActivo);
        value = files.length;
      } catch {
        value = 0;
      }
    }
    const next = { ...photoCountsRef.current, [key]: value };
    photoCountsRef.current = next;
    setPhotoCounts(next);
    return value;
  };

  return { photoCounts, refreshOne };
};
