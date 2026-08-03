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

const InmuebleTable = memo(({ inmuebles, hasActiveFilters, onEdit, onDelete }) => {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Inmueble</TableHead>
            <TableHead>Institución</TableHead>
            <TableHead>Localidad</TableHead>
            <TableHead>Ciudad</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-center">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inmuebles.length > 0 ? (
            inmuebles.map((a) => (
              <TableRow key={a.codigoinmueble}>
                <TableCell className="font-medium">
                  {a.codigoinmueble}
                </TableCell>
                <TableCell className="whitespace-normal break-words max-w-[200px]">
                  {a.inmueble}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {a.codigoinstitucion || "—"}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {a.codigolocalidad || "—"}
                </TableCell>
                <TableCell>{a.codigociudad || "—"}</TableCell>
                <TableCell>
                  <Badge variant={a.estado === 1 ? "default" : "secondary"}>
                    {ESTADO_MAP[a.estado] || "—"}
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
                    ? "No se encontraron inmuebles"
                    : "No hay inmuebles registrados"}
                </p>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
});

InmuebleTable.displayName = "InmuebleTable";
export default InmuebleTable;
