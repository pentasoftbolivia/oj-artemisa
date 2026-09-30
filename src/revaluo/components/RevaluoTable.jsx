import { memo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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

const rowKeyOf = (a) => String(a.codigoActivoInterno ?? a.codigoactivointerno ?? a.codigoActivo ?? a._codigoActivo);

// Clave de factor según estado: Ba si está de Baja, si no según conservación (B/R/M, por defecto B)
const factorKeyFor = (a) => {
  const estado = String(a.estado ?? a.estadoActivo ?? "").trim().toUpperCase();
  if (estado === "0" || estado === "FALSE" || estado === "BAJA") return "Ba";
  const c = String(a._estadoConservacion || "").trim().toUpperCase();
  if (c.startsWith("R")) return "R";
  if (c.startsWith("M")) return "M";
  return "B";
};

const parseNum = (v) => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? null : n;
};

const calcRow = (a, ws, factores) => {
  const nums = [ws.c1, ws.c2, ws.c3].map(parseNum).filter((n) => n !== null);
  const promedio = nums.length > 0 ? nums.reduce((s, n) => s + n, 0) / nums.length : null;
  const fkey = factorKeyFor(a);
  // Factor de la fila si está lleno, si no el global por defecto (solo referencial F.Años)
  const effFactor = (prefix) => {
    const row = parseNum(ws[`${prefix}${fkey}`]);
    if (row !== null) return row;
    return parseNum(factores?.[`${prefix}${fkey}`]);
  };
  const fa = effFactor("fa");
  const vidaRaw = a._vidaUtil != null && String(a._vidaUtil).trim() !== "" ? Number(a._vidaUtil) : null;
  const vida = vidaRaw !== null && !isNaN(vidaRaw) ? vidaRaw : null;
  const vidaTipoRaw = a._vidaTipo != null && String(a._vidaTipo).trim() !== "" ? Number(a._vidaTipo) : null;
  const vidaTipo = vidaTipoRaw !== null && !isNaN(vidaTipoRaw) ? vidaTipoRaw : null;
  // Años Asignados = vida útil según rubro y estado de conservación (cuadros).
  // Vacío si no hay valor en estadoconservacion de act_activos.
  const consRaw = String(a.estadoconservacion ?? a.estadoConservacion ?? "").trim();
  const anios = consRaw === "" ? null : vida;
  // Factor Revalúo = Promedio × Años Asig. (en la subcolumna del estado)
  const fr = promedio !== null && anios !== null
    ? promedio * anios
    : null;
  // Precio Revalúo = Factor Revalúo / Años x tipo
  const precio = fr !== null && vidaTipo !== null && vidaTipo !== 0 ? fr / vidaTipo : null;
  return { promedio, precio, anios, fkey, fr, fa, vida, vidaTipo };
};

const fmtBs = (v) => (v === null ? "—" : `Bs ${Number(v).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const fmtNum = (v) => (v === null ? "—" : (Number.isInteger(v) ? String(v) : String(Number(v.toFixed(2)))));

const RevaluoTable = memo(({ activos, hasActiveFilters, onEdit, onOpenImages, photoCounts = {}, worksheet = {}, onWorksheetChange, factores = {} }) => {
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

  const getWs = (a) => worksheet[rowKeyOf(a)] || {};

  return (
    <>
      {/* Móvil: cards */}
      <div className="flex flex-col gap-3 sm:hidden">
        {activos.map((a) => {
          const rk = rowKeyOf(a);
          const ws = getWs(a);
          const calc = calcRow(a, ws, factores);
          return (
            <div key={rk} className="rounded-lg border bg-card p-3 space-y-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-xs font-bold bg-primary/10 text-primary px-2 py-1 rounded break-all">{a._codigoActivo || "—"}</span>
                {(() => {
                  const v = a.estado ?? a.estadoActivo ?? "";
                  const key = String(v).trim();
                  const upper = key.toUpperCase();
                  const label = ESTADO_MAP[v] ?? ESTADO_MAP[key] ?? ESTADO_MAP[upper] ?? (key ? (upper === "ALTA" ? "Alta" : upper === "BAJA" ? "Baja" : key) : "—");
                  const isAlta = label === "Alta";
                  return <Badge variant={isAlta ? "secondary" : "destructive"} className={isAlta ? "bg-yellow-400 text-yellow-900 border-yellow-500 text-[11px] shrink-0" : "bg-red-600 text-white border-red-600 text-[11px] shrink-0"}>{label}</Badge>;
                })()}
              </div>
              <div className="text-sm font-medium leading-tight break-words line-clamp-2">{a.descripcionActivo ?? a.descripcionactivo ?? "—"}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Rubro</div>
                  <div className="break-words leading-tight">{a._rubro || "—"}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Tipo</div>
                  <div className="break-words leading-tight">{a._tipoRubro || "—"}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Conservación</div>
                  <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-medium ${String(a._estadoConservacion || "").toUpperCase() === "NUEVO" ? "bg-blue-100 text-blue-800" : String(a._estadoConservacion || "").toUpperCase() === "BUENO" ? "bg-green-100 text-green-800" : String(a._estadoConservacion || "").toUpperCase() === "REGULAR" ? "bg-yellow-100 text-yellow-800" : String(a._estadoConservacion || "").toUpperCase() === "MALO" ? "bg-red-100 text-red-800" : "bg-muted text-muted-foreground"}`}>{a._estadoConservacion || "—"}</span>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Años x tipo</div>
                  <div className="font-semibold">{fmtNum(calc.vidaTipo)}</div>
                </div>
              </div>
              <div className="space-y-1 text-xs">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Ubicación</div>
                <div className="break-words leading-tight text-muted-foreground">{a._ubicacion || "—"}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Responsable</div>
                  <div className="truncate font-medium">{a._responsableName || "—"}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Carnet</div>
                  <div className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded inline-block">{a._carnet || "—"}</div>
                </div>
              </div>
              {a.observaciones ? (
                <div className="text-xs space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Observaciones</div>
                  <div className="break-words leading-tight text-muted-foreground line-clamp-3">{String(a.observaciones).trim()}</div>
                </div>
              ) : null}
              <div className="rounded-md border p-2 space-y-2 bg-muted/30">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Cotización (Bs)</div>
                <div className="grid grid-cols-3 gap-2">
                  {[["c1", "1"], ["c2", "2"], ["c3", "3"]].map(([f, label]) => (
                    <div key={f} className="space-y-1">
                      <div className="text-[10px] text-muted-foreground text-center">{label}</div>
                      <Input type="number" min="0" step="0.01" className="h-9 text-xs text-right bg-yellow-50" value={ws[f] || ""} onChange={(e) => onWorksheetChange?.(rk, f, e.target.value)} />
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Promedio:</span>
                  <span className="font-mono font-semibold">{fmtBs(calc.promedio)}</span>
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold pt-1">N° Cotización</div>
                <div className="grid grid-cols-3 gap-2">
                  {[["n1", "1"], ["n2", "2"], ["n3", "3"]].map(([f, label]) => (
                    <div key={f} className="space-y-1">
                      <div className="text-[10px] text-muted-foreground text-center">{label}</div>
                      <Input className="h-9 text-xs bg-orange-50" value={ws[f] || ""} onChange={(e) => onWorksheetChange?.(rk, f, e.target.value)} />
                    </div>
                  ))}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold pt-1">Factor Revalúo (B/R/M/Ba)</div>
                <div className="grid grid-cols-4 gap-2">
                  {["B", "R", "M", "Ba"].map((label) => (
                    <div key={label} className="space-y-1">
                      <div className="text-[10px] text-muted-foreground text-center">{label}</div>
                      <div className={`h-9 flex items-center justify-center text-xs font-mono rounded-md border ${calc.fkey === label ? "border-emerald-500 font-bold" : "text-muted-foreground bg-muted/30"}`}>
                        {calc.fkey === label ? fmtNum(calc.fr) : "—"}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold pt-1">Factor Años (B/R/M/Ba)</div>
                <div className="grid grid-cols-4 gap-2">
                  {["B", "R", "M", "Ba"].map((label) => (
                    <div key={label} className="space-y-1">
                      <div className="text-[10px] text-muted-foreground text-center">{label}</div>
                      <div className={`h-9 flex items-center justify-center text-xs font-mono rounded-md border ${calc.fkey === label ? "border-emerald-500 font-bold" : "text-muted-foreground bg-muted/30"}`}>
                        {calc.fkey === label ? fmtNum(calc.anios) : "—"}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">Precio Revalúo:</span>
                  <span className="font-mono font-bold text-emerald-700">{fmtBs(calc.precio)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">Años Asignados:</span>
                  <span className="font-mono font-bold">{fmtNum(calc.anios)}</span>
                </div>
              </div>
              <div className="flex gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => onEdit?.(a)} className="flex-1 min-h-11 gap-2">
                  <Edit className="h-4 w-4" /> Editar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onOpenImages?.(a)} className="flex-1 min-h-11 gap-1 border">
                  <ImageIcon className="h-4 w-4" /> Fotos
                  <span className="text-xs font-mono font-bold bg-muted px-1.5 py-0.5 rounded border ml-1">({(() => { const c = photoCounts[String(a.codigoActivo)] ?? photoCounts[a.codigoActivo]; return c === undefined ? "…" : String(c); })()})</span>
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: tabla */}
      <div className="hidden sm:block rounded-md border overflow-x-auto">
        <Table>
          <TableHeader className="[&_th]:bg-blue-100">
            <TableRow>
              <TableHead rowSpan={2} className="min-w-[110px]">Código Activo</TableHead>
              <TableHead rowSpan={2} className="min-w-[130px]">Rubro</TableHead>
              <TableHead rowSpan={2} className="min-w-[130px]">Tipo Rubro</TableHead>
              <TableHead rowSpan={2} className="min-w-[220px]">Descripción</TableHead>
              <TableHead rowSpan={2} className="min-w-[110px]">Conservación</TableHead>
              <TableHead rowSpan={2} className="min-w-[80px] text-center">Años x tipo</TableHead>
              <TableHead rowSpan={2} className="min-w-[160px]">Responsable</TableHead>
              <TableHead rowSpan={2} className="min-w-[100px]">Carnet</TableHead>
              <TableHead rowSpan={2} className="min-w-[280px]">Ubicación</TableHead>
              <TableHead colSpan={3} className="text-center border-x !bg-yellow-100">Cotización (Bs)</TableHead>
              <TableHead rowSpan={2} className="min-w-[110px] text-right">Promedio</TableHead>
              <TableHead colSpan={3} className="text-center border-x !bg-orange-100">N° Cotización</TableHead>
              <TableHead colSpan={4} className="text-center border-x">Factor Revalúo</TableHead>
              <TableHead rowSpan={2} className="min-w-[70px] text-center">F. Rev</TableHead>
              <TableHead colSpan={4} className="text-center border-x">Factor Años</TableHead>
              <TableHead rowSpan={2} className="min-w-[120px] text-right !bg-orange-100">Precio Revalúo</TableHead>
              <TableHead rowSpan={2} className="min-w-[90px] text-center">Años Asig.</TableHead>
              <TableHead rowSpan={2} className="text-center min-w-[110px]">Acciones</TableHead>
            </TableRow>
            <TableRow>
              <TableHead className="text-center min-w-[95px] !bg-yellow-100">1</TableHead>
              <TableHead className="text-center min-w-[95px] !bg-yellow-100">2</TableHead>
              <TableHead className="text-center min-w-[95px] !bg-yellow-100">3</TableHead>
              <TableHead className="text-center min-w-[85px] !bg-orange-100">1</TableHead>
              <TableHead className="text-center min-w-[85px] !bg-orange-100">2</TableHead>
              <TableHead className="text-center min-w-[85px] !bg-orange-100">3</TableHead>
              <TableHead className="text-center min-w-[70px]">B</TableHead>
              <TableHead className="text-center min-w-[70px]">R</TableHead>
              <TableHead className="text-center min-w-[70px]">M</TableHead>
              <TableHead className="text-center min-w-[70px]">Ba</TableHead>
              <TableHead className="text-center min-w-[70px]">B</TableHead>
              <TableHead className="text-center min-w-[70px]">R</TableHead>
              <TableHead className="text-center min-w-[70px]">M</TableHead>
              <TableHead className="text-center min-w-[70px]">Ba</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activos.map((a) => {
              const rk = rowKeyOf(a);
              const ws = getWs(a);
              const calc = calcRow(a, ws, factores);
              return (
                <TableRow key={rk}>
                  <TableCell className="font-mono text-xs">{a._codigoActivo || "—"}</TableCell>
                  <TableCell className="text-xs whitespace-normal break-words max-w-[160px]">{a._rubro || "—"}</TableCell>
                  <TableCell className="text-xs whitespace-normal break-words max-w-[160px]">{a._tipoRubro || "—"}</TableCell>
                  <TableCell className="text-xs whitespace-normal break-words max-w-[260px]">{a.descripcionActivo ?? a.descripcionactivo ?? "—"}</TableCell>
                  <TableCell className="text-xs">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${String(a._estadoConservacion || "").toUpperCase() === "NUEVO" ? "bg-blue-100 text-blue-800" : String(a._estadoConservacion || "").toUpperCase() === "BUENO" ? "bg-green-100 text-green-800" : String(a._estadoConservacion || "").toUpperCase() === "REGULAR" ? "bg-yellow-100 text-yellow-800" : String(a._estadoConservacion || "").toUpperCase() === "MALO" ? "bg-red-100 text-red-800" : "bg-muted text-muted-foreground"}`}
                    >
                      {a._estadoConservacion || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-center font-semibold">{fmtNum(calc.vidaTipo)}</TableCell>
                  <TableCell className="text-xs whitespace-normal break-words max-w-[180px]">{a._responsableName || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{a._carnet || "—"}</TableCell>
                  <TableCell className="text-xs whitespace-normal break-words max-w-[320px]">{a._ubicacion || "—"}</TableCell>
                  {[["c1"], ["c2"], ["c3"]].map(([f]) => (
                    <TableCell key={f} className="p-1 bg-yellow-50">
                      <Input type="number" min="0" step="0.01" className="h-8 w-[90px] text-xs text-right bg-yellow-50" value={ws[f] || ""} onChange={(e) => onWorksheetChange?.(rk, f, e.target.value)} />
                    </TableCell>
                  ))}
                  <TableCell className="font-mono text-xs text-right whitespace-nowrap">{fmtBs(calc.promedio)}</TableCell>
                  {[["n1"], ["n2"], ["n3"]].map(([f]) => (
                    <TableCell key={f} className="p-1 bg-orange-50">
                      <Input className="h-8 w-[80px] text-xs bg-orange-50" value={ws[f] || ""} onChange={(e) => onWorksheetChange?.(rk, f, e.target.value)} />
                    </TableCell>
                  ))}
                  {[["frB", "B"], ["frR", "R"], ["frM", "M"], ["frBa", "Ba"]].map(([f, label]) => (
                    <TableCell key={f} className={`p-1 font-mono text-xs text-center ${calc.fkey === label ? "bg-emerald-50 font-bold" : "text-muted-foreground"}`}>
                      {calc.fkey === label ? fmtNum(calc.fr) : "—"}
                    </TableCell>
                  ))}
                  <TableCell className="font-mono text-xs text-center" title={`Factor ${calc.fkey}`}>{calc.fr !== null ? fmtNum(calc.fr) : "—"}</TableCell>
                  {[["faB", "B"], ["faR", "R"], ["faM", "M"], ["faBa", "Ba"]].map(([f, label]) => (
                    <TableCell key={f} className={`p-1 font-mono text-xs text-center ${calc.fkey === label ? "bg-emerald-50 font-bold" : "text-muted-foreground"}`}>
                      {calc.fkey === label ? fmtNum(calc.anios) : "—"}
                    </TableCell>
                  ))}
                  <TableCell className="font-mono text-xs text-right font-bold text-emerald-700 whitespace-nowrap bg-orange-50">{fmtBs(calc.precio)}</TableCell>
                  <TableCell className="font-mono text-xs text-center font-bold">{fmtNum(calc.anios)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-1 justify-center">
                      <Button variant="ghost" size="sm" onClick={() => onEdit?.(a)} title="Editar" className="text-yellow-500 hover:text-yellow-700 h-9 w-9 p-0">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => onOpenImages?.(a)} title="Ver fotos" className="text-blue-500 hover:text-blue-700 h-9 w-9 p-0">
                          <ImageIcon className="h-4 w-4" />
                        </Button>
                        <span className="text-xs font-mono font-bold min-w-[26px] text-center bg-muted px-1.5 py-0.5 rounded border">({(() => { const c = photoCounts[String(a.codigoActivo)] ?? photoCounts[a.codigoActivo]; return c === undefined ? "…" : String(c); })()})</span>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
});

RevaluoTable.displayName = "RevaluoTable";

export default RevaluoTable;
