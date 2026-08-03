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
import { Barcode, QrCode, Edit, Trash2, Package } from "lucide-react";
import DataPagination from "@/components/ui/data-pagination";
import { buildDenominacion } from "@/lib/utils";

const ESTADO_MAP = { 1: "Activo", 0: "Inactivo" };

const ActivosFijosTable = memo(({
  activosFijos,
  isLoading,
  filters,
  totalCount,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  rubroMap,
  tipoRubroMap,
  ambienteMap,
  ambienteNivelMap,
  nivelInmuebleMap,
  inmuebleMap,
  inmuebleCiudadMap,
  ciudadMap,
  nivelMap,
  onBarcode,
  onQr,
  onEdit,
  onDelete
}) => {
  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Rubro</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Denominación</TableHead>
              <TableHead>Valor Actual</TableHead>
              <TableHead>Ciudad</TableHead>
              <TableHead>Inmueble</TableHead>
              <TableHead>Nivel</TableHead>
              <TableHead>Ambiente</TableHead>
              <TableHead>CI Responsable</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activosFijos.length > 0 ? (
              activosFijos.map((a) => (
                <TableRow key={a.codigoActivoInterno}>
                  <TableCell className="font-mono text-xs">
                    {a.codigoActivo != null ? `OJ-02-${a.codigoActivo}` : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs whitespace-normal break-words max-w-[180px]">
                    {rubroMap[a.tiporubroact] ??
                      rubroMap[a.tipoRubroAct] ??
                      "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs whitespace-normal break-words text-wrap min-w-[150px] max-w-[250px]">
                    {tipoRubroMap[a.tiporubroact] ??
                      tipoRubroMap[a.tipoRubroAct] ??
                      a.tiporubroact ??
                      a.tipoRubroAct ??
                      "—"}
                  </TableCell>
                  <TableCell className="whitespace-normal break-words text-wrap min-w-[200px] max-w-[350px]">
                    {buildDenominacion(a, rubroMap[a.tiporubroact] ?? rubroMap[a.tipoRubroAct] ?? "")}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {a.valorActual != null
                      ? `Bs ${Number(a.valorActual).toFixed(2)}`
                      : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs whitespace-normal break-words max-w-[180px]">
                    {(() => {
                      const amb = String(a.codigoAmbiente ?? a.codigoambiente).trim();
                      if (!amb) return "—";
                      const codNivel = ambienteNivelMap[amb];
                      if (!codNivel) return "—";
                      const codInmueble = nivelInmuebleMap[String(codNivel).trim()];
                      if (!codInmueble) return "—";
                      const codCiudad = inmuebleCiudadMap[String(codInmueble).trim()];
                      if (!codCiudad) return "—";
                      return ciudadMap[String(codCiudad).trim()] ?? "—";
                    })()}
                  </TableCell>
                  <TableCell className="font-mono text-xs whitespace-normal break-words max-w-[180px]">
                    {(() => {
                      const amb = String(a.codigoAmbiente ?? a.codigoambiente).trim();
                      if (!amb) return "—";
                      const codNivel = ambienteNivelMap[amb];
                      if (!codNivel) return "—";
                      const codInmueble = nivelInmuebleMap[String(codNivel).trim()];
                      if (!codInmueble) return "—";
                      return inmuebleMap[String(codInmueble).trim()] ?? "—";
                    })()}
                  </TableCell>
                  <TableCell className="font-mono text-xs whitespace-normal break-words max-w-[180px]">
                    {(() => {
                      const amb = String(a.codigoAmbiente ?? a.codigoambiente).trim();
                      if (!amb) return "—";
                      const codNivel = ambienteNivelMap[amb];
                      return codNivel ? (nivelMap[String(codNivel).trim()] ?? "—") : "—";
                    })()}
                  </TableCell>
                  <TableCell className="font-mono text-xs whitespace-normal break-words max-w-[180px]">
                    {ambienteMap[String(a.codigoAmbiente ?? a.codigoambiente).trim()] ??
                      a.ambiente ??
                      a.Ambiente ??
                      "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {a.cirun || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={a.estado === 1 ? "default" : "secondary"}
                    >
                      {ESTADO_MAP[a.estado] || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex space-x-1 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onBarcode(a)}
                        title="Código de barras"
                        className="text-green-600 hover:text-green-800"
                      >
                        <Barcode className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onQr(a)}
                        title="Código QR"
                        className="text-purple-600 hover:text-purple-800"
                      >
                        <QrCode className="h-4 w-4" />
                      </Button>
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
                  colSpan={11}
                  className="text-center py-12 text-muted-foreground"
                >
                  <Package className="mx-auto h-12 w-12 opacity-20 mb-2" />
                  <p className="text-lg font-medium">
                    {isLoading
                      ? "Cargando..."
                      : filters.search
                        ? "No se encontraron activos fijos"
                        : "No hay activos fijos registrados"}
                  </p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {totalCount > 0 && (
        <DataPagination
          currentPage={currentPage}
          totalPages={Math.max(1, Math.ceil(totalCount / pageSize))}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </>
  );
});

ActivosFijosTable.displayName = "ActivosFijosTable";
export default ActivosFijosTable;
