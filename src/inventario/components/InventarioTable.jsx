import { memo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Image as ImageIcon, Package } from "lucide-react";
import { buildDenominacion } from "@/lib/utils";

const InventarioTable = memo(({
  data,
  isLoading,
  getAmbienteName,
  getResponsableName,
  onEdit,
  onOpenImages,
  onToggleAprobado
}) => {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código Activo</TableHead>
            <TableHead>Rubro</TableHead>
            <TableHead>Tipo Rubro</TableHead>
            <TableHead>Descripción del Activo</TableHead>
            <TableHead>Ambiente</TableHead>
            <TableHead>Responsable</TableHead>
            <TableHead>Carnet Responsable</TableHead>
            <TableHead>Inventariador</TableHead>
            <TableHead className="text-center">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length > 0 ? (
            data.map((a) => {
              const isApproved = a.estadoinventario === "APROBADO";
              const displayInventariador = a.usuarioinventario || "—";
              return (
                <TableRow
                  key={a.codigoActivoInterno}
                  className={isApproved
                    ? "bg-green-50/70 hover:bg-green-100/70 dark:bg-green-950/20 dark:hover:bg-green-900/30"
                    : "bg-orange-50/50 hover:bg-orange-100/50 dark:bg-orange-950/10 dark:hover:bg-orange-900/20"
                  }
                >
                  <TableCell className="font-mono text-xs">
                    {a._codigoActivo}
                  </TableCell>
                  <TableCell className="font-mono text-xs whitespace-normal break-words max-w-[180px]">
                    {a._rubro}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {a._tipoRubro}
                  </TableCell>
                  <TableCell className="whitespace-normal break-words max-w-[250px]">
                    {buildDenominacion(a, a._rubro)}
                  </TableCell>
                  <TableCell className="font-mono text-xs whitespace-normal break-words max-w-[200px]">
                    {getAmbienteName(a._ambienteKey)}
                  </TableCell>
                  <TableCell className="font-mono text-xs whitespace-normal break-words max-w-[200px]">
                    {getResponsableName(a._ci)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {a._carnetResponsable}
                  </TableCell>
                  <TableCell className="text-xs max-w-[150px] truncate" title={displayInventariador}>
                    {displayInventariador}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex space-x-1 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(a)}
                        className="text-yellow-500 hover:text-yellow-700"
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        EDITAR
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onOpenImages(a)}
                        className="text-blue-500 hover:text-blue-700"
                      >
                        <ImageIcon className="h-4 w-4 mr-1" />
                        IMÁGENES
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => onToggleAprobado(a)}
                        className={
                          a.estadoinventario === "APROBADO"
                            ? "bg-green-600 hover:bg-green-700 text-white"
                            : "bg-red-600 hover:bg-red-700 text-white"
                        }
                      >
                        {a.estadoinventario === "APROBADO" ? "APROBADO" : "PENDIENTE"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                <Package className="mx-auto h-12 w-12 opacity-20 mb-2" />
                <p className="text-lg font-medium">
                  {isLoading ? "Cargando..." : "No se encontraron activos"}
                </p>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
});

InventarioTable.displayName = "InventarioTable";
export default InventarioTable;
