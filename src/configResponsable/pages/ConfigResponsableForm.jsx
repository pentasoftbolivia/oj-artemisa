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

const ESTADO_OPTIONS = [
  { value: "1", label: "Activo" },
  { value: "0", label: "Inactivo" },
];

const getToday = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const parseDate = (val) => {
  if (!val) return "";
  try {
    return val.substring(0, 10);
  } catch {
    return "";
  }
};

const INITIAL_STATE = {
  cirun: "",
  cargo: "",
  nombre1: "",
  nombre2: "",
  paterno: "",
  materno: "",
  estado: "1",
  fechaRegistro: getToday(),
};

const ConfigResponsableForm = ({ responsableToEdit, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (responsableToEdit) {
      setFormData({
        cirun: (responsableToEdit.cirun || "").trim(),
        cargo: (responsableToEdit.cargo || "").trim(),
        nombre1: (responsableToEdit.nombre1 || "").trim(),
        nombre2: (responsableToEdit.nombre2 || "").trim(),
        paterno: (responsableToEdit.paterno || "").trim(),
        materno: (responsableToEdit.materno || "").trim(),
        estado: responsableToEdit.estado != null ? String(responsableToEdit.estado) : "1",
        fechaRegistro: parseDate(responsableToEdit.fechaRegistro) || getToday(),
      });
      setErrors({});
    } else {
      setFormData(INITIAL_STATE);
      setErrors({});
    }
  }, [responsableToEdit]);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
    if (errors[id]) {
      setErrors((prev) => ({ ...prev, [id]: "" }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = {};
    if (!formData.cirun.trim()) newErrors.cirun = "El CI es requerido";
    if (!formData.nombre1.trim()) newErrors.nombre1 = "El primer nombre es requerido";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const submitData = {
        cirun: formData.cirun.trim(),
        cargo: formData.cargo,
        nombre1: formData.nombre1,
        nombre2: formData.nombre2,
        paterno: formData.paterno,
        materno: formData.materno,
        estado: formData.estado || "1",
        fechaRegistro: formData.fechaRegistro || getToday(),
      };
      const success = await onSubmit(submitData);
      if (!success) {
        setIsSubmitting(false);
        return;
      }
    } catch (error) {
      console.error("Error en el formulario de responsable:", error);
      setErrors({ general: "Error inesperado al guardar el responsable" });
      setIsSubmitting(false);
    }
  };

  const isEditing = Boolean(responsableToEdit);

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cirun">Carnet</Label>
          <Input
            id="cirun"
            value={formData.cirun}
            onChange={handleChange}
            placeholder="ej: 1000043"
            disabled={isSubmitting || isEditing}
            maxLength={50}
            className={errors.cirun ? "border-red-500" : ""}
          />
          {errors.cirun && <p className="text-sm text-red-500">{errors.cirun}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="cargo">Cargo</Label>
          <Input
            id="cargo"
            value={formData.cargo}
            onChange={handleChange}
            placeholder="ej: CAJERO"
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nombre1">Primer Nombre</Label>
          <Input
            id="nombre1"
            value={formData.nombre1}
            onChange={handleChange}
            placeholder="ej: JUAN"
            required
            disabled={isSubmitting}
            className={errors.nombre1 ? "border-red-500" : ""}
          />
          {errors.nombre1 && <p className="text-sm text-red-500">{errors.nombre1}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="nombre2">Segundo Nombre</Label>
          <Input
            id="nombre2"
            value={formData.nombre2}
            onChange={handleChange}
            placeholder="ej: CARLOS"
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="paterno">Apellido Paterno</Label>
          <Input
            id="paterno"
            value={formData.paterno}
            onChange={handleChange}
            placeholder="ej: LOPEZ"
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="materno">Apellido Materno</Label>
          <Input
            id="materno"
            value={formData.materno}
            onChange={handleChange}
            placeholder="ej: MAMANI"
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="estado">Estado</Label>
          <Select
            value={formData.estado}
            onValueChange={(value) => handleChange({ target: { id: "estado", value } })}
            disabled={isSubmitting}
          >
            <SelectTrigger className="w-full [&>span]:line-clamp-1 text-left">
              <SelectValue placeholder="Seleccionar estado" />
            </SelectTrigger>
            <SelectContent>
              {ESTADO_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {errors.general && (
        <div className="text-sm text-white text-center p-3 bg-red-600 rounded">
          {errors.general}
        </div>
      )}

      <div className="flex justify-end space-x-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || !formData.cirun.trim() || !formData.nombre1.trim()}
        >
          {isSubmitting
            ? "Procesando..."
            : responsableToEdit
              ? "Actualizar"
              : "Guardar"}
        </Button>
      </div>
    </form>
  );
};

export default ConfigResponsableForm;