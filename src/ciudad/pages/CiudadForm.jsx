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
  codigociudad: "",
  codigounidadejecutora: "",
  descripcion: "",
  estado: "",
  login_sid: "",
};

const CiudadForm = ({ ciudadToEdit, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (ciudadToEdit) {
      setFormData({
        codigociudad: ciudadToEdit.codigociudad != null ? String(ciudadToEdit.codigociudad) : "",
        codigounidadejecutora: ciudadToEdit.codigounidadejecutora != null ? String(ciudadToEdit.codigounidadejecutora) : "",
        descripcion: (ciudadToEdit.descripcion || "").trim(),
        estado: ciudadToEdit.estado != null ? String(ciudadToEdit.estado) : "",
        login_sid: ciudadToEdit.login_sid || "",
      });
    } else {
      setFormData(INITIAL_STATE);
    }
    setErrors({});
  }, [ciudadToEdit]);

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
    if (!formData.descripcion.trim()) newErrors.descripcion = "La descripción de la ciudad es requerida";
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setIsSubmitting(true);
    try {
      const submitData = { ...formData };
      ["codigociudad", "codigounidadejecutora", "estado"].forEach(f => { if (submitData[f] === "") submitData[f] = null; });
      const success = await onSubmit(submitData);
      if (!success) setIsSubmitting(false);
    } catch {
      setErrors({ general: "Error inesperado" });
      setIsSubmitting(false);
    }
  };

  const isEditing = Boolean(ciudadToEdit);

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 py-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="codigociudad">Código Ciudad</Label>
          <Input
            id="codigociudad"
            type="number"
            value={formData.codigociudad}
            onChange={handleChange}
            placeholder="ej: 1"
            disabled={isSubmitting || isEditing}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="codigounidadejecutora">Código Unidad Ejecutora</Label>
          <Input
            id="codigounidadejecutora"
            type="number"
            value={formData.codigounidadejecutora}
            onChange={handleChange}
            placeholder="ej: 101"
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="descripcion">Ciudad</Label>
        <Input
          id="descripcion"
          value={formData.descripcion}
          onChange={handleChange}
          placeholder="ej: La Paz"
          required
          disabled={isSubmitting}
          maxLength={100}
          className={errors.descripcion ? "border-red-500" : ""}
        />
        {errors.descripcion && <p className="text-sm text-red-500">{errors.descripcion}</p>}
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
              <SelectItem value="1">Activo</SelectItem>
              <SelectItem value="0">Inactivo</SelectItem>
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
        <Button type="submit" disabled={isSubmitting || !formData.descripcion.trim()}>
          {isSubmitting ? "Procesando..." : ciudadToEdit ? "Actualizar" : "Guardar"}
        </Button>
      </div>
    </form>
  );
};

export default CiudadForm;
