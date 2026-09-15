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
    <form onSubmit={handleSubmit} className="grid gap-3 sm:gap-4 py-2 sm:py-4 max-h-[65vh] sm:max-h-[60vh] overflow-y-auto pr-1 -mr-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="cirun" className="text-xs sm:text-sm">
            Carnet
          </Label>
          <Input
            id="cirun"
            value={formData.cirun}
            onChange={handleChange}
            placeholder="ej: 1000043"
            disabled={isSubmitting || isEditing}
            maxLength={50}
            className={`h-11 sm:h-9 ${errors.cirun ? "border-red-500" : ""}`}
          />
          {errors.cirun && <p className="text-xs sm:text-sm text-red-500">{errors.cirun}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cargo" className="text-xs sm:text-sm">
            Cargo
          </Label>
          <Input id="cargo" value={formData.cargo} onChange={handleChange} placeholder="ej: CAJERO" disabled={isSubmitting} className="h-11 sm:h-9" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="nombre1" className="text-xs sm:text-sm">
            Primer Nombre
          </Label>
          <Input
            id="nombre1"
            value={formData.nombre1}
            onChange={handleChange}
            placeholder="ej: JUAN"
            required
            disabled={isSubmitting}
            className={`h-11 sm:h-9 ${errors.nombre1 ? "border-red-500" : ""}`}
          />
          {errors.nombre1 && <p className="text-xs sm:text-sm text-red-500">{errors.nombre1}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="nombre2" className="text-xs sm:text-sm">
            Segundo Nombre
          </Label>
          <Input id="nombre2" value={formData.nombre2} onChange={handleChange} placeholder="ej: CARLOS" disabled={isSubmitting} className="h-11 sm:h-9" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="paterno" className="text-xs sm:text-sm">
            Apellido Paterno
          </Label>
          <Input id="paterno" value={formData.paterno} onChange={handleChange} placeholder="ej: LOPEZ" disabled={isSubmitting} className="h-11 sm:h-9" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="materno" className="text-xs sm:text-sm">
            Apellido Materno
          </Label>
          <Input id="materno" value={formData.materno} onChange={handleChange} placeholder="ej: MAMANI" disabled={isSubmitting} className="h-11 sm:h-9" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="estado" className="text-xs sm:text-sm">
            Estado
          </Label>
          <Select value={formData.estado} onValueChange={(value) => handleChange({ target: { id: "estado", value } })} disabled={isSubmitting}>
            <SelectTrigger className="w-full [&>span]:line-clamp-1 text-left h-11 sm:h-9">
              <SelectValue placeholder="Seleccionar estado" />
            </SelectTrigger>
            <SelectContent>
              {ESTADO_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
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

      <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="w-full sm:w-auto min-h-11 sm:min-h-9 order-2 sm:order-1">
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting || !formData.cirun.trim() || !formData.nombre1.trim()} className="w-full sm:w-auto min-h-11 sm:min-h-9 order-1 sm:order-2">
          {isSubmitting ? "Procesando..." : responsableToEdit ? "Actualizar" : "Guardar"}
        </Button>
      </div>
    </form>
  );
};

export default ConfigResponsableForm;