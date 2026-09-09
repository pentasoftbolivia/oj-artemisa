import { memo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Image as ImageIcon, Package } from "lucide-react";

const ESTADO_MAP = {
  1: "Alta",
  0: "Baja",
  "1": "Alta",
  "0": "Baja",
  true: "Alta",
  false: "Baja",
  ALTA: "Alta",
  BAJA: "Baja",
  Alta: "Alta",
  Baja: "Baja",
};

const RevaluoTable = memo(({ activos, hasActiveFilters, onEdit, onOpenImages, photoCounts = {} }) => {
  if (!activos || activos.length === 0) {
    return (
      <div className="text-center py-12 border rounded-md">
        <Package className="mx-auto h-10 w-10 opacity-20 mb-2" />
        <p className="text-sm text-muted-foreground">
          {hasActiveFilters
            ? "No se encontraron activos que coincidan con los filtros."
            : "No hay activos marcados para revalúo (pararevaluo = TRUE)."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[140px]">Rubro</TableHead>
            <TableHead className="min-w-[140px]">Tipo Rubro</TableHead>
            <TableHead className="min-w-[250px]">Descripción Activo</TableHead>
            <TableHead className="min-w-[320px]">Ubicación</TableHead>
            <TableHead className="min-w-[180px]">Responsable</TableHead>
            <TableHead className="min-w-[110px]">Carnet</TableHead>
            <TableHead className="min-w-[140px]">Inventariador</TableHead>
            <TableHead className="min-w-[220px]">Observaciones</TableHead>
            <TableHead className="min-w-[120px]">Conservación</TableHead>
            <TableHead className="min-w-[110px]">Código Activo</TableHead>
            <TableHead className="min-w-[110px] text-right">Valor Actual</TableHead>
            <TableHead className="min-w-[90px] text-center">Estado</TableHead>
            <TableHead className="text-center min-w-[110px]">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activos.map((a) => (
            <TableRow key={String(a.codigoActivoInterno ?? a.codigoactivointerno ?? a._codigoActivo)}>
              <TableCell className="text-xs whitespace-normal break-words max-w-[180px]">{a._rubro || "—"}</TableCell>
              <TableCell className="text-xs whitespace-normal break-words max-w-[180px]">{a._tipoRubro || "—"}</TableCell>
              <TableCell className="text-xs whitespace-normal break-words max-w-[300px]">{a.descripcionActivo ?? a.descripcionactivo ?? "—"}</TableCell>
              <TableCell className="text-xs whitespace-normal break-words max-w-[380px]">{a._ubicacion || "—"}</TableCell>
              <TableCell className="text-xs whitespace-normal break-words max-w-[200px]">{a._responsableName || "—"}</TableCell>
              <TableCell className="font-mono text-xs">{a._carnet || "—"}</TableCell>
              <TableCell className="text-xs max-w-[140px] truncate" title={a._inventariador || ""}>
                {a._inventariador || "—"}
              </TableCell>
              <TableCell className="text-xs whitespace-normal break-words max-w-[240px]" title={a.observaciones || ""}>
                {a.observaciones ? String(a.observaciones).trim() : "—"}
              </TableCell>
              <TableCell className="text-xs">
                <span
                  className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${String(a._estadoConservacion || "").toUpperCase() === "BUENO"
                    ? "bg-green-100 text-green-800"
                    : String(a._estadoConservacion || "").toUpperCase() === "REGULAR"
                      ? "bg-yellow-100 text-yellow-800"
                      : String(a._estadoConservacion || "").toUpperCase() === "MALO"
                        ? "bg-red-100 text-red-800"
                        : "bg-muted text-muted-foreground"
                    }`}
                >
                  {a._estadoConservacion || "—"}
                </span>
              </TableCell>
              <TableCell className="font-mono text-xs">{a._codigoActivo || "—"}</TableCell>
              <TableCell className="font-mono text-xs text-right">{a._valorActual ?? "—"}</TableCell>
              <TableCell className="text-center">
                {(() => {
                  const v = a.estado ?? a.estadoActivo ?? "";
                  const key = String(v).trim();
                  const upper = key.toUpperCase();
                  const label = ESTADO_MAP[v] ?? ESTADO_MAP[key] ?? ESTADO_MAP[upper] ?? (key ? (upper === "ALTA" ? "Alta" : upper === "BAJA" ? "Baja" : key) : "—");
                  const isAlta = label === "Alta";
                  return (
                    <Badge variant={isAlta ? "secondary" : "destructive"} className={isAlta ? "bg-yellow-400 text-yellow-900 border-yellow-500 hover:bg-yellow-500 text-xs" : "bg-red-600 text-white border-red-600 hover:bg-red-700 text-xs"}>
                      {label}
                    </Badge>
                  );
                })()}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center gap-1 justify-center">
                  <Button variant="ghost" size="sm" onClick={() => onEdit?.(a)} title="Editar" className="text-yellow-500 hover:text-yellow-700">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onOpenImages?.(a)} title="Ver fotos" className="text-blue-500 hover:text-blue-700">
                      <ImageIcon className="h-4 w-4" />
                    </Button>
                    <span className="text-xs font-mono font-bold min-w-[26px] text-center bg-muted px-1.5 py-0.5 rounded border">
                      ({(() => {
                        const c = photoCounts[String(a.codigoActivo)] ?? photoCounts[a.codigoActivo];
                        return c === undefined ? "…" : String(c);
                      })()})
                    </span>
                  </div>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
});

RevaluoTable.displayName = "RevaluoTable";

export default RevaluoTable;
