import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const INITIAL_STATE = {
  codigorubroact: "",
  descripcionrubroact: "",
  vidautil: "",
  coheficiente: "",
  estado: "",
  login_sid: "",
  tipo: "",
};

const ESTADO_OPTIONS = [
  { value: "ACTIVO", label: "Activo" },
  { value: "INACTIVO", label: "Inactivo" },
];

const RubroForm = ({ rubroToEdit, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (rubroToEdit) {
      setFormData({
        codigorubroact: rubroToEdit.codigorubroact != null ? String(rubroToEdit.codigorubroact) : "",
        descripcionrubroact: (rubroToEdit.descripcionrubroact || "").trim(),
        vidautil: rubroToEdit.vidautil != null ? String(rubroToEdit.vidautil) : "",
        coheficiente: rubroToEdit.coheficiente != null ? String(rubroToEdit.coheficiente) : "",
        estado: rubroToEdit.estado || "",
        login_sid: rubroToEdit.login_sid || "",
        tipo: (rubroToEdit.tipo || "").trim(),
      });
    } else {
      setFormData(INITIAL_STATE);
    }
    setErrors({});
  }, [rubroToEdit]);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(p => ({ ...p, [id]: value }));
    if (errors[id]) setErrors(p => ({ ...p, [id]: "" }));
  };

  const handleSelectChange = (field, value) => {
    setFormData(p => ({ ...p, [field]: value }));
    if (errors[field]) setErrors(p => ({ ...p, [field]: "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!formData.descripcionrubroact.trim()) newErrors.descripcionrubroact = "La descripción del rubro es requerida";
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setIsSubmitting(true);
    try {
      const submitData = { ...formData };
      ["codigorubroact", "vidautil", "coheficiente"].forEach(f => { if (submitData[f] === "") submitData[f] = null; });
      const success = await onSubmit(submitData);
      if (!success) setIsSubmitting(false);
    } catch {
      setErrors({ general: "Error inesperado" });
      setIsSubmitting(false);
    }
  };

  const isEditing = Boolean(rubroToEdit);

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 py-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="codigorubroact">Código Rubro</Label>
          <Input
            id="codigorubroact"
            type="number"
            value={formData.codigorubroact}
            onChange={handleChange}
            placeholder="ej: 1"
            disabled={isSubmitting || isEditing}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="descripcionrubroact">Descripción Rubro</Label>
          <Input
            id="descripcionrubroact"
            value={formData.descripcionrubroact}
            onChange={handleChange}
            placeholder="ej: Muebles y Enseres"
            required
            disabled={isSubmitting}
            className={errors.descripcionrubroact ? "border-red-500" : ""}
          />
          {errors.descripcionrubroact && <p className="text-sm text-red-500">{errors.descripcionrubroact}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="vidautil">Vida Útil (años)</Label>
          <Input
            id="vidautil"
            type="number"
            value={formData.vidautil}
            onChange={handleChange}
            placeholder="ej: 10"
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="coheficiente">Coeficiente</Label>
          <Input
            id="coheficiente"
            type="number"
            step="0.0001"
            value={formData.coheficiente}
            onChange={handleChange}
            placeholder="ej: 0.1"
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tipo">Tipo</Label>
          <Input
            id="tipo"
            value={formData.tipo}
            onChange={handleChange}
            placeholder="ej: MUE"
            disabled={isSubmitting}
            maxLength={5}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="estado">Estado</Label>
          <Select
            value={formData.estado}
            onValueChange={(value) => handleSelectChange("estado", value)}
            disabled={isSubmitting}
          >
            <SelectTrigger className="w-full [&>span]:line-clamp-1 text-left">
              <SelectValue placeholder="Seleccionar estado" />
            </SelectTrigger>
            <SelectContent>
              {ESTADO_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="login_sid">Login</Label>
          <Input
            id="login_sid"
            value={formData.login_sid}
            onChange={handleChange}
            placeholder="Login de sesión"
            disabled={isSubmitting}
          />
        </div>
      </div>

      {errors.general && <div className="text-sm text-white text-center p-3 bg-red-600 rounded">{errors.general}</div>}
      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancelar</Button>
        <Button type="submit" disabled={isSubmitting || !formData.descripcionrubroact.trim()}>
          {isSubmitting ? "Procesando..." : rubroToEdit ? "Actualizar" : "Guardar"}
        </Button>
      </div>
    </form>
  );
};

export default RubroForm;
