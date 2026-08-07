import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export const ActivoGeneralFields = ({ formData, handleChange, isSubmitting, isEditing }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div className="space-y-2">
      <Label htmlFor="codigoActivoInterno">Código Interno</Label>
      <Input
        id="codigoActivoInterno"
        type="number"
        value={formData.codigoActivoInterno}
        onChange={handleChange}
        placeholder="ej: 226689"
        disabled={isSubmitting || isEditing}
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="codigoActivo">Código Activo</Label>
      <Input
        id="codigoActivo"
        type="number"
        value={formData.codigoActivo}
        onChange={handleChange}
        placeholder="ej: 1"
        disabled={isSubmitting}
      />
    </div>
  </div>
);
