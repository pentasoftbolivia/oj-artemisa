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
import { Edit, Trash2, Building2 } from "lucide-react";

const RubroTable = memo(({ rubros, hasActiveFilters, onEdit, onDelete }) => {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead>Vida Útil</TableHead>
            <TableHead>Coeficiente</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-center">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rubros.length > 0 ? (
            rubros.map((a) => (
              <TableRow key={a.codigorubroact}>
                <TableCell className="font-medium">
                  {a.codigorubroact}
                </TableCell>
                <TableCell className="whitespace-normal break-words max-w-[200px]">
                  {a.descripcionrubroact}
                </TableCell>
                <TableCell className="text-center">
                  {a.vidautil != null ? `${a.vidautil} años` : "—"}
                </TableCell>
                <TableCell className="text-center">
                  {a.coheficiente != null ? a.coheficiente : "—"}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {a.tipo || "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={a.estado === "ACTIVO" ? "default" : "secondary"}
                  >
                    {a.estado || "—"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex space-x-1 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(a)}
                      title="Editar"
                      className="text-yellow-500 hover:text-yellow-700"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(a)}
                      title="Eliminar"
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
                colSpan={7}
                className="text-center py-12 text-muted-foreground"
              >
                <Building2 className="mx-auto h-12 w-12 opacity-20 mb-2" />
                <p className="text-lg font-medium">
                  {hasActiveFilters
                    ? "No se encontraron rubros"
                    : "No hay rubros registrados"}
                </p>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
});

RubroTable.displayName = "RubroTable";
export default RubroTable;
