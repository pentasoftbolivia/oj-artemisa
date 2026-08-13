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
import { Users, Edit, Trash2, Printer, FileText, Loader2 } from "lucide-react";
import { useActaAsignacion } from "../hooks/useActaAsignacion";
import { useToast } from "@/hooks/use-toast";
import ActaPreviewModal from "./ActaPreviewModal";

const ESTADO_MAP = { 0: "Inactivo", 1: "Activo" };

const getNumeroActa = (r, ambienteCodes) => {
  const codes = Array.isArray(ambienteCodes) && ambienteCodes.length > 0
    ? new Set(ambienteCodes.map(String))
    : null;
  if (codes) {
    const found = (r.actas || []).find((a) =>
      a.codigoambiente && codes.has(String(a.codigoambiente)),
    );
    return found ? found.numeroacta : "—";
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
  ambienteCodes
}) => {
  const { printActaAsignacion, printActaListado, isPrinting, printingId } = useActaAsignacion();
  const { toast } = useToast();
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [selectedPrintData, setSelectedPrintData] = useState(null);

  const handlePrintClick = (r, type) => {
    if (!locationFilters?.ambiente) {
      toast({
        title: "Seleccione un ambiente",
        description: "Debe seleccionar un ambiente para imprimir el acta de asignación.",
        variant: "destructive",
      });
      return;
    }
    setSelectedPrintData({ responsable: r, type, locationFilters: locationFilters || {} });
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
                  {getNumeroActa(r, ambienteCodes)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex space-x-1 justify-end">
                    {locationFilters?.ambiente ? (
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(r)}
                      title="Eliminar responsable"
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
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
