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
  codigoinmueble: "",
  inmueble: "",
  estado: "",
  codigoinstitucion: "",
  login_sid: "",
  codigolocalidad: "",
  codigociudad: "",
};

const InmuebleForm = ({ inmuebleToEdit, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (inmuebleToEdit) {
      setFormData({
        codigoinmueble: inmuebleToEdit.codigoinmueble != null ? String(inmuebleToEdit.codigoinmueble) : "",
        inmueble: (inmuebleToEdit.inmueble || "").trim(),
        estado: inmuebleToEdit.estado != null ? String(inmuebleToEdit.estado) : "",
        codigoinstitucion: (inmuebleToEdit.codigoinstitucion || "").trim(),
        login_sid: inmuebleToEdit.login_sid || "",
        codigolocalidad: (inmuebleToEdit.codigolocalidad || "").trim(),
        codigociudad: inmuebleToEdit.codigociudad != null ? String(inmuebleToEdit.codigociudad) : "",
      });
    } else {
      setFormData(INITIAL_STATE);
    }
    setErrors({});
  }, [inmuebleToEdit]);

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
    if (!formData.inmueble.trim()) newErrors.inmueble = "El nombre del inmueble es requerido";
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setIsSubmitting(true);
    try {
      const submitData = { ...formData };
      ["codigoinmueble", "estado", "codigociudad"].forEach(f => { if (submitData[f] === "") submitData[f] = null; });
      const success = await onSubmit(submitData);
      if (!success) setIsSubmitting(false);
    } catch {
      setErrors({ general: "Error inesperado" });
      setIsSubmitting(false);
    }
  };

  const isEditing = Boolean(inmuebleToEdit);

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 py-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="codigoinmueble">Código Inmueble</Label>
          <Input
            id="codigoinmueble"
            type="number"
            value={formData.codigoinmueble}
            onChange={handleChange}
            placeholder="ej: 1"
            disabled={isSubmitting || isEditing}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="inmueble">Inmueble</Label>
          <Input
            id="inmueble"
            value={formData.inmueble}
            onChange={handleChange}
            placeholder="ej: Edificio Central"
            required
            disabled={isSubmitting}
            className={errors.inmueble ? "border-red-500" : ""}
          />
          {errors.inmueble && <p className="text-sm text-red-500">{errors.inmueble}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="codigoinstitucion">Código Institución</Label>
          <Input
            id="codigoinstitucion"
            value={formData.codigoinstitucion}
            onChange={handleChange}
            placeholder="ej: OJ-LP"
            disabled={isSubmitting}
            maxLength={10}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="codigolocalidad">Código Localidad</Label>
          <Input
            id="codigolocalidad"
            value={formData.codigolocalidad}
            onChange={handleChange}
            placeholder="ej: LOC-01"
            disabled={isSubmitting}
            maxLength={20}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <SelectItem value="1">Activo</SelectItem>
              <SelectItem value="0">Inactivo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="codigociudad">Código Ciudad</Label>
          <Input
            id="codigociudad"
            type="number"
            value={formData.codigociudad}
            onChange={handleChange}
            placeholder="ej: 1"
            disabled={isSubmitting}
          />
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
        <Button type="submit" disabled={isSubmitting || !formData.inmueble.trim()}>
          {isSubmitting ? "Procesando..." : inmuebleToEdit ? "Actualizar" : "Guardar"}
        </Button>
      </div>
    </form>
  );
};

export default InmuebleForm;
