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
import { ClipboardList } from "lucide-react";

const AsignacionesTable = memo(({ asignaciones, hasActiveFilters }) => {
  const getNombreCompleto = (a) => {
    const partes = [a.nombre1, a.nombre2, a.paterno, a.materno].filter(Boolean);
    return partes.join(" ") || "—";
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código Activo</TableHead>
            <TableHead>Denominación</TableHead>
            <TableHead>Serie</TableHead>
            <TableHead>Marca</TableHead>
            <TableHead>Grupo</TableHead>
            <TableHead>Tipo Grupo</TableHead>
            <TableHead>Responsable</TableHead>
            <TableHead>CI</TableHead>
            <TableHead>Cargo</TableHead>
            <TableHead>Ubicación</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {asignaciones.length > 0 ? (
            asignaciones.map((a, i) => (
              <TableRow key={a.codigoactivo ?? `row-${i}`}>
                <TableCell className="font-medium whitespace-normal break-words max-w-[180px]">
                  {a.codigoactivo || "—"}
                </TableCell>
                <TableCell className="whitespace-normal break-words max-w-[250px]">
                  {a.descripcionactivo || "—"}
                </TableCell>
                <TableCell className="whitespace-normal break-words max-w-[120px]">
                  {a.serie || "—"}
                </TableCell>
                <TableCell className="whitespace-normal break-words max-w-[150px]">
                  {a.marcamaterial || "—"}
                </TableCell>
                <TableCell className="whitespace-normal break-words max-w-[150px]">
                  {a.grupo || "—"}
                </TableCell>
                <TableCell className="whitespace-normal break-words max-w-[150px]">
                  {a.tipogrupo || "—"}
                </TableCell>
                <TableCell className="font-medium whitespace-normal break-words max-w-[180px]">
                  {getNombreCompleto(a)}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {a.cirun || "—"}
                </TableCell>
                <TableCell className="whitespace-normal break-words max-w-[150px]">
                  {a.cargoresponsable || "—"}
                </TableCell>
                <TableCell className="whitespace-normal break-words max-w-[200px]">
                  {[a.descripcion, a.inmueble, a.nivel, a.ambiente]
                    .filter(Boolean)
                    .join(" - ") || "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={(a.estado || "") === "Activo" ? "default" : "secondary"}
                    className={
                      a.estado === "Baja"
                        ? "bg-gray-100 text-gray-600 hover:bg-gray-100"
                        : ""
                    }
                  >
                    {a.estado || "Desconocido"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                <ClipboardList className="mx-auto h-12 w-12 opacity-20 mb-2" />
                <p className="text-lg font-medium">
                  {hasActiveFilters
                    ? "No se encontraron asignaciones que coincidan con los filtros"
                    : "Usa los filtros para buscar asignaciones"}
                </p>
                <p className="text-sm mt-1">
                  {hasActiveFilters ? "Intenta ajustar los filtros de búsqueda" : ""}
                </p>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
});

AsignacionesTable.displayName = "AsignacionesTable";
export default AsignacionesTable;
