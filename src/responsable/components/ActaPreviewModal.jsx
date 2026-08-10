import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { loadActaData } from "../hooks/useActaAsignacion";
import { buildDenominacion } from "@/lib/utils";

const ActaPreviewModal = ({ isOpen, onClose, onAccept, responsable, type, locationFilters }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && responsable) {
      const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
          const result = await loadActaData(responsable, locationFilters || {});
          setData(result);
        } catch (err) {
          console.error("Error al cargar datos del acta", err);
          setError("Ocurrió un error al cargar la vista previa. Intente de nuevo.");
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    } else {
      setData(null);
      setError(null);
    }
  }, [isOpen, responsable, locationFilters]);

  const title = type === "asignacion" 
    ? "Vista Previa: Acta de Asignación" 
    : "Vista Previa: Listado de Activos";
    
  const fullName = responsable 
    ? `${responsable.nombre1 || ""} ${responsable.nombre2 || ""} ${responsable.paterno || ""} ${responsable.materno || ""}`.replace(/\s+/g, " ").trim()
    : "";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[90vw] md:max-w-6xl max-h-[90vh] flex flex-col p-6">
        <DialogHeader>
          <DialogTitle className="text-xl">{title}</DialogTitle>
          <DialogDescription>
            Revisa la información antes de proceder a la impresión.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col my-2">
          {loading ? (
            <div className="flex flex-col justify-center items-center py-12">
              <LoadingSpinner containerHeight="100px" />
              <p className="mt-4 text-muted-foreground animate-pulse">Cargando datos del acta...</p>
            </div>
          ) : error ? (
            <div className="text-center text-red-500 py-8 bg-red-50 rounded-md">
              {error}
            </div>
          ) : data ? (
            <div className="flex-1 min-h-0 flex flex-col space-y-4">
              <div className="shrink-0 bg-muted/30 p-4 rounded-lg border flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                  <h3 className="font-semibold text-lg">{fullName}</h3>
                  <p className="text-sm text-muted-foreground">C.I.: {responsable?.cirun || "—"}</p>
                </div>
                <div className="bg-primary/10 text-primary px-4 py-2 rounded-md font-medium text-center">
                  Total de activos: {data.assets.length}
                </div>
              </div>

              {locationFilters &&
                (locationFilters.ciudad ||
                  locationFilters.inmueble ||
                  locationFilters.nivel ||
                  locationFilters.ambiente) ? (
                <div className="shrink-0 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-muted-foreground">
                    Ubicación seleccionada:
                  </span>
                  {Object.entries(locationFilters)
                    .filter(([, v]) => Boolean(v))
                    .map(([key, value]) => (
                      <span
                        key={key}
                        className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md font-medium capitalize"
                      >
                        {key}: {value}
                      </span>
                    ))}
                </div>
              ) : null}

              {data.assets.length > 0 ? (
                <div className="flex-1 min-h-0 rounded-md border shadow-sm flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-auto">
                    <Table>
                      <TableHeader className="bg-muted/50 sticky top-0">
                        <TableRow>
                          <TableHead className="w-[100px]">Código</TableHead>
                          <TableHead className="w-[100px]">Rubro</TableHead>
                          <TableHead className="w-[100px]">Tipo</TableHead>
                          <TableHead className="w-[200px]">Descripción</TableHead>
                          <TableHead className="w-[150px]">Observaciones</TableHead>
                          <TableHead className="w-[150px]">Ubicación</TableHead>
                          <TableHead className="w-[80px] text-center">Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.assets.map((a, i) => {
                          const trId = a.tipoRubroAct || a.tiporubroact;
                          const rn = (data.tipoRubroMap[trId] || "").trim();
                          const tn = (data.descTipoRubroMap[trId] || "").trim();
                          const desc = (buildDenominacion(a, rn) || "").trim();
                          const obs = (a.observaciones || "").toString().trim();
                          const codBase = (a.codigoActivo || a.codigoactivo || "").toString().trim();
                          const codigoFormateado = codBase ? `OJ-02-${codBase}` : "—";
                          const ubicacion = (data.resolveUbicacion(a.codigoAmbiente || a.codigoambiente) || "").trim();
                          const estadoCons = (a.estadoConservacion || a.estadoconservacion || "REGULAR").toString().trim().toUpperCase();

                          return (
                            <TableRow key={i}>
                              <TableCell className="font-mono text-xs">{codigoFormateado}</TableCell>
                              <TableCell className="text-xs whitespace-normal break-words max-w-[100px]">{rn}</TableCell>
                              <TableCell className="text-xs whitespace-normal break-words max-w-[100px]">{tn}</TableCell>
                              <TableCell className="text-xs whitespace-normal break-words max-w-[250px]">{desc}</TableCell>
                              <TableCell className="text-xs whitespace-normal break-words max-w-[150px]">{obs}</TableCell>
                              <TableCell className="text-xs whitespace-normal break-words max-w-[150px]">{ubicacion}</TableCell>
                              <TableCell className="text-center text-xs font-medium">{estadoCons}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-12 border rounded-md">
                  No hay activos asociados a este funcionario.
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t mt-auto">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={onAccept} disabled={loading || !data || data.assets.length === 0}>
            Aceptar (Imprimir)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ActaPreviewModal;
