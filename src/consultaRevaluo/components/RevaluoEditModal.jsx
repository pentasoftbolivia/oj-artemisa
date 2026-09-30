import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const RevaluoEditModal = ({
  isEditOpen,
  setIsEditOpen,
  editActivo,
  setEditActivo,
  editForm,
  handleEditChange,
  handleEditSelectChange,
  isSaving,
  handleEditSave,
  ambientes = [],
  tipoRubroOptions = [],
  rubroFromTipo = {},
}) => {
  const rubroDesc = editActivo ? rubroFromTipo[editActivo.tipoRubroAct] || "" : "";

  return (
    <Dialog
      open={isEditOpen}
      onOpenChange={(open) => {
        if (!open) {
          setIsEditOpen(false);
          setEditActivo(null);
        }
      }}
    >
      <DialogContent className="w-[96vw] sm:max-w-[780px] max-h-[90vh] sm:max-h-[85vh] overflow-y-auto p-4 sm:p-6" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader className="pr-6 space-y-1">
          <DialogTitle className="text-base sm:text-lg leading-tight">EDITAR ACTIVO - REVALUO</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm leading-tight">Solo se permiten editar los datos mostrados en la lista de Revalúo.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:gap-4 py-2 sm:py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="codigoActivo" className="text-xs sm:text-sm">
                Código de Activo
              </Label>
              <Input id="codigoActivo" value={editForm.codigoActivo || ""} disabled readOnly className="bg-muted h-11 sm:h-9 text-sm" />
              <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">No editable (identificador)</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="valorActual" className="text-xs sm:text-sm">
                Valor Actual (Bs)
              </Label>
              <Input id="valorActual" type="number" step="0.01" value={editForm.valorActual || ""} onChange={handleEditChange} disabled={isSaving} className="h-11 sm:h-9 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="tipoRubroAct" className="text-xs sm:text-sm">
                Tipo Rubros
              </Label>
              <Select value={editForm.tipoRubroAct || ""} onValueChange={(v) => handleEditSelectChange("tipoRubroAct", v)} disabled={isSaving}>
                <SelectTrigger className="h-11 sm:h-9 text-sm">
                  <SelectValue placeholder="Seleccionar tipo rubro" />
                </SelectTrigger>
                <SelectContent>
                  {tipoRubroOptions.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight break-words">Rubro actual: {editForm.rubro || rubroDesc || "—"}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="estadoConservacion" className="text-xs sm:text-sm">
                Estado Conservación
              </Label>
              <Select value={editForm.estadoConservacion || "REGULAR"} onValueChange={(v) => handleEditSelectChange("estadoConservacion", v)} disabled={isSaving}>
                <SelectTrigger className="h-11 sm:h-9 text-sm">
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BUENO">BUENO</SelectItem>
                  <SelectItem value="REGULAR">REGULAR</SelectItem>
                  <SelectItem value="MALO">MALO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="estado" className="text-xs sm:text-sm">
                Estado (Alta/Baja)
              </Label>
              <Select value={editForm.estado || "1"} onValueChange={(v) => handleEditSelectChange("estado", v)} disabled={isSaving}>
                <SelectTrigger className="h-11 sm:h-9 text-sm">
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Alta</SelectItem>
                  <SelectItem value="0">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="descripcionActivo" className="text-xs sm:text-sm">
              Descripción Activo
            </Label>
            <Textarea id="descripcionActivo" value={editForm.descripcionActivo || ""} onChange={handleEditChange} disabled={isSaving} rows={3} className="text-sm min-h-[88px] sm:min-h-[72px]" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="codigoAmbiente" className="text-xs sm:text-sm">
              Ubicación (Ambiente)
            </Label>
            <Select value={editForm.codigoAmbiente || ""} onValueChange={(v) => handleEditSelectChange("codigoAmbiente", v)} disabled={isSaving}>
              <SelectTrigger className="h-11 sm:h-9 text-sm">
                <SelectValue placeholder="Seleccionar ambiente" />
              </SelectTrigger>
              <SelectContent>
                {ambientes.map((a) => (
                  <SelectItem key={a.codigoambiente} value={String(a.codigoambiente).trim()}>
                    {`${a.codigoambiente} - ${a.ambiente}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cirun" className="text-xs sm:text-sm">
                Carnet (CI Responsable)
              </Label>
              <Input id="cirun" value={editForm.cirun || ""} onChange={handleEditChange} disabled={isSaving} placeholder="Ej: 1234567" className="h-11 sm:h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="usuarioinventario" className="text-xs sm:text-sm">
                Inventariador (email)
              </Label>
              <Input id="usuarioinventario" value={editForm.usuarioinventario || ""} onChange={handleEditChange} disabled={isSaving} placeholder="usuario@organo.judicial" className="h-11 sm:h-9 text-sm" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="observaciones" className="text-xs sm:text-sm">
              Observaciones
            </Label>
            <Textarea id="observaciones" value={editForm.observaciones || ""} onChange={handleEditChange} disabled={isSaving} rows={2} className="text-sm min-h-[72px] sm:min-h-[60px]" />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => { setIsEditOpen(false); setEditActivo(null); }} disabled={isSaving} className="w-full sm:w-auto min-h-11 sm:min-h-9 order-2 sm:order-1">
            Cancelar
          </Button>
          <Button onClick={handleEditSave} disabled={isSaving} className="w-full sm:w-auto min-h-11 sm:min-h-9 order-1 sm:order-2">
            {isSaving ? "Guardando..." : "GUARDAR"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RevaluoEditModal;
