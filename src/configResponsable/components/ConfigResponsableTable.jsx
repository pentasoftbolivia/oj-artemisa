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
import { Edit, Trash2, Users } from "lucide-react";

const ESTADO_MAP = { 1: "Activo", 0: "Inactivo" };

const ConfigResponsableTable = memo(({ responsables, hasActiveFilters, onEdit, onDelete }) => {
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
            <TableHead>Estado</TableHead>
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
                <TableCell className="whitespace-normal break-words max-w-[200px]">
                  {r.nombre1?.trim() || "—"}
                </TableCell>
                <TableCell className="whitespace-normal break-words max-w-[200px]">
                  {r.nombre2?.trim() || "—"}
                </TableCell>
                <TableCell className="whitespace-normal break-words max-w-[200px]">
                  {r.paterno?.trim() || "—"}
                </TableCell>
                <TableCell className="whitespace-normal break-words max-w-[200px]">
                  {r.materno?.trim() || "—"}
                </TableCell>
                <TableCell className="whitespace-normal break-words max-w-[200px]">
                  {r.cargo?.trim() || "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={Number(r.estado) === 1 ? "default" : "destructive"}>
                    {ESTADO_MAP[Number(r.estado)] || "—"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex space-x-1 justify-end">
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
                    ? "No se encontraron responsables"
                    : "No hay responsables registrados"}
                </p>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
});

ConfigResponsableTable.displayName = "ConfigResponsableTable";
export default ConfigResponsableTable;