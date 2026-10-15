import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ComboboxField from "@/components/ui/combobox-field";
import { FileDown, FileSpreadsheet, Loader2, ListOrdered } from "lucide-react";
import { useListaActas } from "../hooks/useListaActas";

const ListaActasModal = ({ open, onOpenChange }) => {
  const [ciudad, setCiudad] = useState("");
  const [inmueble, setInmueble] = useState("");
  const {
    ciudadOptions,
    inmuebleOptionsByCiudad,
    isLoadingCatalogs,
    actas,
    isLoadingActas,
    isGenerating,
    loadCatalogs,
    fetchActas,
    etiquetaOf,
    generateExcel,
    generatePDF,
  } = useListaActas();

  useEffect(() => {
    if (open) {
      loadCatalogs();
      setCiudad("");
      setInmueble("");
    }
  }, [open, loadCatalogs]);

  useEffect(() => {
    if (!open) return;
    if (!ciudad && !inmueble) return;
    fetchActas(ciudad, inmueble);
  }, [open, ciudad, inmueble, fetchActas]);

  const handleCiudadChange = (val) => {
    setCiudad(val || "");
    setInmueble("");
  };

  const etiqueta = etiquetaOf(ciudad, inmueble);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[94vw] sm:max-w-[860px] p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base sm:text-lg leading-tight flex items-center gap-2">
            <ListOrdered className="h-5 w-5 shrink-0" />
            Lista Actas
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm leading-tight">
            Seleccione la ciudad o el inmueble para ver las actas generadas. Luego descargue el listado en Excel o PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
          <ComboboxField
            label="Ciudad"
            value={ciudad}
            onValueChange={handleCiudadChange}
            options={ciudadOptions}
            placeholder="Seleccionar ciudad..."
            searchPlaceholder="Buscar ciudad..."
            emptyMessage="Sin resultados"
            loading={isLoadingCatalogs}
            wrapText
          />
          <ComboboxField
            label="Inmueble"
            value={inmueble}
            onValueChange={(val) => setInmueble(val || "")}
            options={inmuebleOptionsByCiudad(ciudad)}
            placeholder="Seleccionar inmueble..."
            searchPlaceholder="Buscar inmueble..."
            emptyMessage="Sin resultados"
            loading={isLoadingCatalogs}
            disabled={!ciudad}
            wrapText
          />
        </div>

        <div className="rounded-md border overflow-x-auto">
          {isLoadingActas ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando actas...
            </div>
          ) : !ciudad && !inmueble ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              Seleccione una ciudad o un inmueble para ver las actas generadas.
            </p>
          ) : actas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              No hay actas generadas en la ubicación seleccionada.
            </p>
          ) : (
            <>
              <p className="text-xs sm:text-sm font-medium px-3 pt-3">
                {actas.length} acta(s) en {etiqueta}
              </p>
              <div className="max-h-[38vh] overflow-y-auto p-3">
                <table className="w-full text-xs sm:text-sm border-collapse">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="border px-2 py-1.5 text-center w-10">N°</th>
                      <th className="border px-2 py-1.5 text-center">N° Acta</th>
                      <th className="border px-2 py-1.5 text-left">Ciudad</th>
                      <th className="border px-2 py-1.5 text-left">Inmueble</th>
                      <th className="border px-2 py-1.5 text-left">Nivel</th>
                      <th className="border px-2 py-1.5 text-left">Ambiente</th>
                      <th className="border px-2 py-1.5 text-left">Carnet</th>
                      <th className="border px-2 py-1.5 text-left">Responsable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actas.map((a, idx) => (
                      <tr key={`${a.numeroacta}-${a.cirun}`} className="odd:bg-white even:bg-muted/40">
                        <td className="border px-2 py-1 text-center">{idx + 1}</td>
                        <td className="border px-2 py-1 text-center font-mono font-semibold">{a.numeroacta}</td>
                        <td className="border px-2 py-1">{a.ciudad}</td>
                        <td className="border px-2 py-1">{a.inmueble}</td>
                        <td className="border px-2 py-1">{a.nivel}</td>
                        <td className="border px-2 py-1">{a.ambiente}</td>
                        <td className="border px-2 py-1 font-mono">{a.cirun}</td>
                        <td className="border px-2 py-1">{a.responsable}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
          <Button
            onClick={() => generateExcel(actas, etiqueta)}
            disabled={actas.length === 0 || isGenerating || isLoadingActas}
            className="bg-green-700 hover:bg-green-800 text-white w-full min-h-11 text-xs sm:text-sm"
          >
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" /> : <FileSpreadsheet className="mr-2 h-4 w-4 shrink-0" />}
            {isGenerating ? "Generando..." : "Generar Excel"}
          </Button>
          <Button
            onClick={() => generatePDF(actas, etiqueta)}
            disabled={actas.length === 0 || isGenerating || isLoadingActas}
            className="bg-red-600 hover:bg-red-700 text-white w-full min-h-11 text-xs sm:text-sm"
          >
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" /> : <FileDown className="mr-2 h-4 w-4 shrink-0" />}
            {isGenerating ? "Generando..." : "Generar PDF"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ListaActasModal;
