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
  if (!responsables || responsables.length === 0) {
    return (
      <div className="rounded-md border text-center py-12 text-muted-foreground">
        <Users className="mx-auto h-12 w-12 opacity-20 mb-2" />
        <p className="text-lg font-medium">
          {hasActiveFilters ? "No se encontraron responsables" : "No hay responsables registrados"}
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Móvil: cards apiladas */}
      <div className="flex flex-col gap-3 sm:hidden">
        {responsables.map((r) => (
          <div key={r.cirun} className="rounded-lg border bg-card p-3 space-y-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <span className="font-mono text-xs font-bold bg-primary/10 text-primary px-2 py-1 rounded break-all">{r.cirun}</span>
              <Badge variant={Number(r.estado) === 1 ? "default" : "destructive"} className="shrink-0 text-[11px]">
                {ESTADO_MAP[Number(r.estado)] || "—"}
              </Badge>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Nombre completo</div>
              <div className="text-sm font-medium leading-tight break-words">
                {[r.nombre1, r.nombre2, r.paterno, r.materno].map((s) => (s || "").trim()).filter(Boolean).join(" ") || "—"}
              </div>
              <div className="text-xs text-muted-foreground break-words">
                Paterno: {r.paterno?.trim() || "—"} · Materno: {r.materno?.trim() || "—"}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Cargo</div>
              <div className="text-sm break-words">{r.cargo?.trim() || "—"}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => onEdit(r)} className="min-h-11 gap-2">
                <Edit className="h-4 w-4" /> Editar
              </Button>
              <Button variant="destructive" size="sm" onClick={() => onDelete(r)} className="min-h-11 gap-2">
                <Trash2 className="h-4 w-4" /> Eliminar
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: tabla con scroll horizontal */}
      <div className="hidden sm:block rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
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
              {responsables.map((r) => (
                <TableRow key={r.cirun}>
                  <TableCell className="font-medium font-mono text-xs">{r.cirun}</TableCell>
                  <TableCell className="whitespace-normal break-words max-w-[160px] text-xs">{r.nombre1?.trim() || "—"}</TableCell>
                  <TableCell className="whitespace-normal break-words max-w-[160px] text-xs">{r.nombre2?.trim() || "—"}</TableCell>
                  <TableCell className="whitespace-normal break-words max-w-[160px] text-xs">{r.paterno?.trim() || "—"}</TableCell>
                  <TableCell className="whitespace-normal break-words max-w-[160px] text-xs">{r.materno?.trim() || "—"}</TableCell>
                  <TableCell className="whitespace-normal break-words max-w-[160px] text-xs">{r.cargo?.trim() || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={Number(r.estado) === 1 ? "default" : "destructive"}>{ESTADO_MAP[Number(r.estado)] || "—"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex space-x-1 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => onEdit(r)} title="Editar responsable" className="text-yellow-500 hover:text-yellow-700 h-9 w-9 p-0">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onDelete(r)} title="Eliminar responsable" className="text-red-500 hover:text-red-700 h-9 w-9 p-0">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
});

ConfigResponsableTable.displayName = "ConfigResponsableTable";
export default ConfigResponsableTable;