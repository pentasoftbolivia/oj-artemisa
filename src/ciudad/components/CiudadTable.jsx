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

const ESTADO_MAP = { 1: "Activo", 0: "Inactivo" };

const CiudadTable = memo(({ ciudades, hasActiveFilters, onEdit, onDelete }) => {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Ciudad</TableHead>
            <TableHead>Unidad Ejecutora</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-center">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ciudades.length > 0 ? (
            ciudades.map((c) => (
              <TableRow key={c.codigociudad}>
                <TableCell className="font-medium">
                  {c.codigociudad}
                </TableCell>
                <TableCell className="whitespace-normal break-words max-w-[250px]">
                  {c.descripcion}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {c.codigounidadejecutora || "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={c.estado === 1 ? "default" : "secondary"}>
                    {ESTADO_MAP[c.estado] || "—"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex space-x-1 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(c)}
                      title="Editar"
                      className="text-yellow-500 hover:text-yellow-700"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(c)}
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
                colSpan={5}
                className="text-center py-12 text-muted-foreground"
              >
                <Building2 className="mx-auto h-12 w-12 opacity-20 mb-2" />
                <p className="text-lg font-medium">
                  {hasActiveFilters
                    ? "No se encontraron ciudades"
                    : "No hay ciudades registradas"}
                </p>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
});

CiudadTable.displayName = "CiudadTable";
export default CiudadTable;
