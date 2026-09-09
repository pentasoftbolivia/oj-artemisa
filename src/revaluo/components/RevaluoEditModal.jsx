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
      <DialogContent className="sm:max-w-[780px] max-h-[85vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>EDITAR ACTIVO - REVALUO</DialogTitle>
          <DialogDescription>Solo se permiten editar los datos mostrados en la lista de Revalúo.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="codigoActivo">Código de Activo</Label>
              <Input id="codigoActivo" value={editForm.codigoActivo || ""} disabled readOnly className="bg-muted" />
              <p className="text-xs text-muted-foreground">No editable (identificador)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="valorActual">Valor Actual (Bs)</Label>
              <Input id="valorActual" type="number" step="0.01" value={editForm.valorActual || ""} onChange={handleEditChange} disabled={isSaving} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipoRubroAct">Tipo Rubro</Label>
              <Select value={editForm.tipoRubroAct || ""} onValueChange={(v) => handleEditSelectChange("tipoRubroAct", v)} disabled={isSaving}>
                <SelectTrigger>
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
              <p className="text-xs text-muted-foreground">Rubro actual: {editForm.rubro || rubroDesc || "—"}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="estadoConservacion">Estado Conservación</Label>
              <Select value={editForm.estadoConservacion || "REGULAR"} onValueChange={(v) => handleEditSelectChange("estadoConservacion", v)} disabled={isSaving}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BUENO">BUENO</SelectItem>
                  <SelectItem value="REGULAR">REGULAR</SelectItem>
                  <SelectItem value="MALO">MALO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="estado">Estado (Alta/Baja)</Label>
              <Select value={editForm.estado || "1"} onValueChange={(v) => handleEditSelectChange("estado", v)} disabled={isSaving}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Alta</SelectItem>
                  <SelectItem value="0">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcionActivo">Descripción Activo</Label>
            <Textarea id="descripcionActivo" value={editForm.descripcionActivo || ""} onChange={handleEditChange} disabled={isSaving} rows={3} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="codigoAmbiente">Ubicación (Ambiente)</Label>
            <Select value={editForm.codigoAmbiente || ""} onValueChange={(v) => handleEditSelectChange("codigoAmbiente", v)} disabled={isSaving}>
              <SelectTrigger>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cirun">Carnet (CI Responsable)</Label>
              <Input id="cirun" value={editForm.cirun || ""} onChange={handleEditChange} disabled={isSaving} placeholder="Ej: 1234567" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="usuarioinventario">Inventariador (email)</Label>
              <Input id="usuarioinventario" value={editForm.usuarioinventario || ""} onChange={handleEditChange} disabled={isSaving} placeholder="usuario@organo.judicial" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observaciones">Observaciones</Label>
            <Textarea id="observaciones" value={editForm.observaciones || ""} onChange={handleEditChange} disabled={isSaving} rows={2} />
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={() => { setIsEditOpen(false); setEditActivo(null); }} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleEditSave} disabled={isSaving}>
            {isSaving ? "Guardando..." : "GUARDAR"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RevaluoEditModal;
