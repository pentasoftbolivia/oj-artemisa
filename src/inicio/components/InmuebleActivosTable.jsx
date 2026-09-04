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
import { INMUEBLE_ACTIVO_COLUMNAS } from "../constants/inventarioConstants";

export const PaginacionTabla = ({ count, mostrados, page, totalPages, onPrev, onNext }) => (
  <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-t bg-muted/20">
    <span className="text-xs text-muted-foreground">
      Mostrando {mostrados} de {count}
    </span>
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={onPrev} disabled={page <= 1}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-xs font-medium">
        {page} / {totalPages}
      </span>
      <Button variant="outline" size="sm" onClick={onNext} disabled={page >= totalPages}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  </div>
);

export const TablaActivos = ({ items, mapRow }) => (
  <div className="flex-1 overflow-auto">
    <div className="min-w-max">
      <Table>
        <TableHeader className="bg-muted/50 sticky top-0">
          <TableRow>
            {INMUEBLE_ACTIVO_COLUMNAS.map((c) => (
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
                <TableCell key={j} className={INMUEBLE_ACTIVO_COLUMNAS[j].cellClass}>
                  {valor}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  </div>
);

export const SeccionActivos = ({ titulo, tituloClass, headerClass, count, children }) => (
  <div className="rounded-md border shadow-sm flex flex-col overflow-hidden">
    <div className={`px-4 py-3 border-b ${headerClass}`}>
      <span className={`text-sm font-bold ${tituloClass}`}>
        {titulo} ({count})
      </span>
    </div>
    {children}
  </div>
);
