import { memo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Edit, Printer, FileText, Loader2 } from "lucide-react";
import { useActaAsignacion } from "../hooks/useActaAsignacion";
import { useToast } from "@/hooks/use-toast";
import ActaPreviewModal from "./ActaPreviewModal";

const ESTADO_MAP = { 0: "Inactivo", 1: "Activo" };

const getNumeroActa = (r, ambienteCodes, numeroActaFilter) => {
  const codes = Array.isArray(ambienteCodes) && ambienteCodes.length > 0
    ? new Set(ambienteCodes.map(String))
    : null;
  if (codes) {
    // Actas del cirun dentro de los ambientes del filtro (ciudad/inmueble/nivel/ambiente).
    // Si el filtro abarca varias, se listan todas en orden ascendente.
    const matched = (r.actas || [])
      .filter((a) => a.codigoambiente && codes.has(String(a.codigoambiente)))
      .map((a) => String(a.numeroacta ?? "").trim())
      .filter((n) => n !== "");
    if (matched.length === 0) return "—";
    matched.sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
    return matched.join(", ");
  }
  // Sin filtro de ubicación: si se buscó por N° acta, mostrar el acta coincidente.
  const query = String(numeroActaFilter || "").trim().toLowerCase();
  if (query && Array.isArray(r.actas)) {
    const hit = r.actas.find((a) => String(a.numeroacta ?? "").trim().toLowerCase() === query)
      || r.actas.find((a) => String(a.numeroacta ?? "").trim().toLowerCase().includes(query));
    if (hit && String(hit.numeroacta ?? "").trim() !== "") return String(hit.numeroacta).trim();
  }
  return r.numeroacta ?? "—";
};

const ResponsableTable = memo(({
  responsables,
  hasActiveFilters,
  onEdit,
  onDelete,
  messages,
  locationFilters,
  ambienteCodes,
  numeroActaFilter
}) => {
  const { printActaAsignacion, printActaListado, isPrinting, printingId } = useActaAsignacion();
  const { toast } = useToast();
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [selectedPrintData, setSelectedPrintData] = useState(null);

  const canPrintActa = Boolean(locationFilters?.ambiente || String(numeroActaFilter || "").trim());

  const handlePrintClick = (r, type) => {
    // Permitir impresión cuando se busca por Número de Acta aunque no haya ambiente seleccionado
    if (type === "asignacion" && !canPrintActa) {
      toast({
        title: "Seleccione un ambiente",
        description: "Debe seleccionar un ambiente para imprimir el acta de asignación.",
        variant: "destructive",
      });
      return;
    }
    // Si se buscó por acta y no hay ambiente, inferir codigoambiente del acta coincidente
    let effectiveFilters = locationFilters || {};
    if (!effectiveFilters.ambiente && String(numeroActaFilter || "").trim() && Array.isArray(r.actas)) {
      const query = String(numeroActaFilter).trim().toLowerCase();
      const matched = r.actas.find((a) => String(a.numeroacta ?? "").trim().toLowerCase() === query)
        || r.actas.find((a) => String(a.numeroacta ?? "").trim().toLowerCase().includes(query));
      if (matched?.codigoambiente) {
        effectiveFilters = { ...effectiveFilters, ambiente: String(matched.codigoambiente).trim() };
      }
    }
    setSelectedPrintData({ responsable: r, type, locationFilters: effectiveFilters });
    setPrintModalOpen(true);
  };

  const confirmPrint = () => {
    if (!selectedPrintData) return;
    const { responsable, type, locationFilters } = selectedPrintData;
    if (type === "asignacion") {
      printActaAsignacion(responsable, locationFilters);
    } else if (type === "listado") {
      printActaListado(responsable, locationFilters);
    }
    setPrintModalOpen(false);
    setSelectedPrintData(null);
  };

  const closePrintModal = () => {
    setPrintModalOpen(false);
    setSelectedPrintData(null);
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>CI</TableHead>
            <TableHead>Primer Nombre</TableHead>
            <TableHead>Segundo Nombre</TableHead>
            <TableHead>Apellido Paterno</TableHead>
            <TableHead>Apellido Materno</TableHead>
            <TableHead>Cargo</TableHead>
            <TableHead>Estado Activo</TableHead>
            <TableHead>Número Acta</TableHead>
            <TableHead className="text-center">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {responsables.length > 0 ? (
            responsables.map((r) => (
              <TableRow key={r.cirun}>
                <TableCell className="font-medium font-mono text-xs">
                  {r.cirun}
                </TableCell>
                <TableCell>{r.nombre1?.trim() || "—"}</TableCell>
                <TableCell>{r.nombre2?.trim() || "—"}</TableCell>
                <TableCell>{r.paterno?.trim() || "—"}</TableCell>
                <TableCell>{r.materno?.trim() || "—"}</TableCell>
                <TableCell>{r.cargo?.trim() || "—"}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      r.registroActivo === 1 ? "default" : "secondary"
                    }
                  >
                    {ESTADO_MAP[r.registroActivo] ?? "—"}
                  </Badge>
                </TableCell>
                <TableCell className="text-center font-mono text-xs">
                  {getNumeroActa(r, ambienteCodes, numeroActaFilter)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex space-x-1 justify-end">
                    {canPrintActa ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePrintClick(r, "asignacion")}
                        title="Imprimir Acta de Asignación"
                        className="text-blue-500 hover:text-blue-700"
                        disabled={isPrinting && printingId === r.cirun}
                      >
                        {isPrinting && printingId === r.cirun ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Printer className="h-4 w-4" />
                        )}
                      </Button>
                    ) : hasActiveFilters ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Imprimir Acta de Asignación (requiere ambiente o búsqueda por N° Acta)"
                        className="text-blue-500/40"
                        disabled
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePrintClick(r, "listado")}
                      title="Imprimir listado"
                      className="text-teal-500 hover:text-teal-700"
                      disabled={isPrinting && printingId === `${r.cirun}:listado`}
                    >
                      {isPrinting && printingId === `${r.cirun}:listado` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(r)}
                      title="Editar responsable"
                      className="text-yellow-500 hover:text-yellow-700"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={9}
                className="text-center py-12 text-muted-foreground"
              >
                <Users className="mx-auto h-12 w-12 opacity-20 mb-2" />
                <p className="text-lg font-medium">
                  {hasActiveFilters
                    ? messages.empty.filtered
                    : messages.empty.noSearch}
                </p>
                <p className="text-sm mt-1">
                  {hasActiveFilters
                    ? messages.empty.adjustFilters
                    : messages.empty.startSearch}
                </p>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <ActaPreviewModal
        isOpen={printModalOpen}
        onClose={closePrintModal}
        onAccept={confirmPrint}
        responsable={selectedPrintData?.responsable}
        type={selectedPrintData?.type}
        locationFilters={selectedPrintData?.locationFilters}
      />
    </div>
  );
});

ResponsableTable.displayName = "ResponsableTable";
export default ResponsableTable;
