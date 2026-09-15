import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { INMUEBLE_ACTIVO_COLUMNAS, INMUEBLE_ACTIVO_COLUMNAS_PENDIENTES } from "../constants/inventarioConstants";

export const PaginacionTabla = ({ count, mostrados, page, totalPages, onPrev, onNext }) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 sm:px-4 py-2.5 border-t bg-muted/20">
    <span className="text-xs text-muted-foreground text-center sm:text-left">
      Mostrando {mostrados} de {count}
    </span>
    <div className="flex items-center justify-center gap-2">
      <Button variant="outline" size="sm" onClick={onPrev} disabled={page <= 1} className="min-h-9 min-w-9">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-xs font-medium min-w-[44px] text-center">
        {page} / {totalPages}
      </span>
      <Button variant="outline" size="sm" onClick={onNext} disabled={page >= totalPages} className="min-h-9 min-w-9">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  </div>
);

// Vista móvil tipo cards + tabla desktop con scroll
export const TablaActivos = ({ items, mapRow, columnas }) => {
  const cols = columnas || INMUEBLE_ACTIVO_COLUMNAS;
  const isPendientes = cols === INMUEBLE_ACTIVO_COLUMNAS_PENDIENTES;
  return (
    <>
      {/* Mobile: cards apiladas - sin scroll horizontal */}
      <div className="flex flex-col gap-2 p-2 sm:hidden">
        {items.map((a, i) => {
          const row = mapRow(a);
          const [codigo, rubro, tipoRubro, descripcion, ambiente, responsable, ci, estadoInv, usuarioInv] = row;
          return (
            <div key={i} className="rounded-lg border bg-card p-3 space-y-2 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded">{codigo}</span>
                <span className="text-[11px] text-muted-foreground font-mono shrink-0">#{i + 1}</span>
              </div>
              <div className="text-sm font-medium leading-tight break-words line-clamp-2">{descripcion}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Rubro</div>
                  <div className="break-words">{rubro || "—"}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Tipo</div>
                  <div className="break-words">{tipoRubro || "—"}</div>
                </div>
              </div>
              <div className="space-y-1 text-xs">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Ambiente</div>
                <div className="break-words leading-tight text-muted-foreground">{ambiente}</div>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1 border-t text-xs">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Responsable</div>
                  <div className="truncate font-medium">{responsable}</div>
                </div>
                <span className="font-mono text-xs bg-muted px-2 py-1 rounded shrink-0">{ci}</span>
              </div>
              {isPendientes && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Estado Inventario</div>
                    <div className="break-words font-medium">{estadoInv || "—"}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Usuario Inventario</div>
                    <div className="break-words truncate" title={usuarioInv || ""}>
                      {usuarioInv || "—"}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop: tabla con scroll horizontal */}
      <div className="hidden sm:flex flex-1 overflow-auto">
        <div className="min-w-max w-full">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0">
              <TableRow>
                {cols.map((c) => (
                  <TableHead key={c.head} className={c.headClass}>
                    {c.head}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((a, i) => (
                <TableRow key={i}>
                  {mapRow(a).map((valor, j) => (
                    <TableCell key={j} className={cols[j]?.cellClass || "text-xs"}>
                      {valor}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
};

export const SeccionActivos = ({ titulo, tituloClass, headerClass, count, children }) => (
  <div className="rounded-md border shadow-sm flex flex-col overflow-hidden">
    <div className={`px-3 sm:px-4 py-2.5 sm:py-3 border-b flex items-center justify-between gap-2 ${headerClass}`}>
      <span className={`text-xs sm:text-sm font-bold leading-tight ${tituloClass}`}>
        {titulo} ({count})
      </span>
    </div>
    {children}
  </div>
);
