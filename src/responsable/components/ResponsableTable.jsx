import { memo } from "react";
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
import { Users, Edit, Trash2, Printer, Loader2 } from "lucide-react";
import { useActaAsignacion } from "../hooks/useActaAsignacion";

const ESTADO_MAP = { 0: "Inactivo", 1: "Activo" };

const ResponsableTable = memo(({
  responsables,
  hasActiveFilters,
  onEdit,
  onDelete,
  messages
}) => {
  const { printActaAsignacion, isPrinting, printingId } = useActaAsignacion();

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
                <TableCell className="text-right">
                  <div className="flex space-x-1 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => printActaAsignacion(r)}
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
                colSpan={8}
                className="text-center py-12 text-muted-foreground"
              >
                <Users className="mx-auto h-12 w-12 opacity-20 mb-2" />
                <p className="text-lg font-medium">
                  {hasActiveFilters
                    ? messages.empty.filtered
                    : messages.empty.noData}
                </p>
                <p className="text-sm mt-1">
                  {hasActiveFilters
                    ? messages.empty.adjustFilters
                    : messages.empty.createFirst}
                </p>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
});

ResponsableTable.displayName = "ResponsableTable";
export default ResponsableTable;
