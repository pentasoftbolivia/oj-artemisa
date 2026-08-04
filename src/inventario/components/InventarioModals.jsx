import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/ui/loading-spinner";
import {
  BASE_EDIT_FIELDS,
  getRubroFields,
} from "../constants/inventarioConstants";

export const InventarioEditModal = ({
  isEditOpen,
  setIsEditOpen,
  editActivo,
  setEditActivo,
  editForm,
  handleEditChange,
  handleEditSelectChange,
  isSaving,
  handleEditSave,
  ambientes,
  rubroFromTipo,
}) => {
  const renderEditFields = () => {
    if (!editActivo) return null;
    const rubroDesc = rubroFromTipo[editActivo.tipoRubroAct] || "";
    const fields = getRubroFields(rubroDesc);

    return fields.map((f) => (
      <div key={f.key} className="space-y-2">
        <Label htmlFor={f.key}>{f.label}</Label>
        <Input
          id={f.key}
          value={editForm[f.key] || ""}
          onChange={handleEditChange}
          disabled={isSaving}
        />
      </div>
    ));
  };

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
      <DialogContent
        className="sm:max-w-[600px]"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>EDITAR CONTROL DE ACTIVOS</DialogTitle>
          <DialogDescription>
            Modifica los datos del activo fijo
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
          {BASE_EDIT_FIELDS.map((f) => {
            if (f.type === "select") {
              return (
                <div key={f.key} className="space-y-2">
                  <Label htmlFor={f.key}>{f.label}</Label>
                  <Select
                    value={editForm.codigoAmbiente}
                    onValueChange={(v) =>
                      handleEditSelectChange("codigoAmbiente", v)
                    }
                    disabled={isSaving}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar ambiente" />
                    </SelectTrigger>
                    <SelectContent>
                      {ambientes.map((a) => (
                        <SelectItem
                          key={a.codigoambiente}
                          value={String(a.codigoambiente).trim()}
                        >
                          {`${a.codigoambiente} - ${a.ambiente}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            }
            return (
              <div key={f.key} className="space-y-2">
                <Label htmlFor={f.key}>{f.label}</Label>
                <Input
                  id={f.key}
                  value={editForm[f.key] || ""}
                  onChange={f.readonly ? undefined : handleEditChange}
                  disabled={isSaving || f.readonly}
                  readOnly={f.readonly}
                />
              </div>
            );
          })}

          <div className="border-t pt-4 mt-2">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">
              Estado de Conservación
            </h3>
            <Select
              value={editForm.estadoConservacion}
              onValueChange={(v) =>
                handleEditSelectChange("estadoConservacion", v)
              }
              disabled={isSaving}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BUENO">BUENO</SelectItem>
                <SelectItem value="REGULAR">REGULAR</SelectItem>
                <SelectItem value="MALO">MALO</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border-t pt-4 mt-2">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">
              Características
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="marcamaterial">Marca Material</Label>
                <Input
                  id="marcamaterial"
                  value={editForm.marcamaterial || ""}
                  onChange={handleEditChange}
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modelo">Modelo</Label>
                <Input
                  id="modelo"
                  value={editForm.modelo || ""}
                  onChange={handleEditChange}
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="serie">Serie</Label>
                <Input
                  id="serie"
                  value={editForm.serie || ""}
                  onChange={handleEditChange}
                  disabled={isSaving}
                />
              </div>
            </div>
          </div>

          {editActivo && rubroFromTipo[editActivo.tipoRubroAct] && (
            <div className="border-t pt-4 mt-2">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                Campos específicos: {rubroFromTipo[editActivo.tipoRubroAct]}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderEditFields()}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end space-x-2 pt-4">
          <Button
            variant="outline"
            onClick={() => {
              setIsEditOpen(false);
              setEditActivo(null);
            }}
            disabled={isSaving}
          >
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

export const InventarioImagesModal = ({
  isImageModalOpen,
  setIsImageModalOpen,
  selectedActivoImages,
  isLoadingImages,
  imageFiles,
  setImageFiles,
}) => {
  return (
    <Dialog
      open={isImageModalOpen}
      onOpenChange={(open) => {
        if (!open) {
          setIsImageModalOpen(false);
          setImageFiles([]);
        }
      }}
    >
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>
            Imágenes del Activo{" "}
            {selectedActivoImages?._codigoActivo ||
              selectedActivoImages?.codigoActivo}
          </DialogTitle>
          <DialogDescription>
            {isLoadingImages
              ? "Cargando imágenes..."
              : `${imageFiles.length} imagen(es) encontrada(s)`}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 max-h-[70vh] overflow-y-auto">
          {isLoadingImages ? (
            <LoadingSpinner />
          ) : imageFiles.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay imágenes para este activo.
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {imageFiles.map((file) => (
                <div
                  key={file.name}
                  className="border rounded-lg overflow-hidden"
                >
                  <a href={file.url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={file.url}
                      alt={file.name}
                      className="w-full h-40 object-cover hover:opacity-80 transition-opacity"
                    />
                  </a>
                  <div className="p-2 flex justify-between items-center bg-muted/20">
                    <span className="text-xs truncate flex-1">{file.name}</span>
                    <a
                      href={file.url}
                      download={file.name}
                      className="text-blue-500 hover:text-blue-700 ml-2"
                      title="Descargar"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
