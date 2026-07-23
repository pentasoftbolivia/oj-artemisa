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
  cirun: "",
  codigoAmbiente: "",
  nombre1: "",
  nombre2: "",
  paterno: "",
  materno: "",
  estado: "",
  autoriza: "",
  cargo: "",
  loginSid: "",
  usuarioRegistro: "",
  fechaRegistro: "",
  registroActivo: "",
};

const SI_NO_OPTIONS = [
  { value: "0", label: "No" },
  { value: "1", label: "Sí" },
];

const ESTADO_OPTIONS = [
  { value: "0", label: "Inactivo" },
  { value: "1", label: "Activo" },
];

const parseDate = (val) => {
  if (!val) return "";
  try {
    return val.substring(0, 10);
  } catch {
    return "";
  }
};

const ResponsableForm = ({ responsableToEdit, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (responsableToEdit) {
      setFormData({
        cirun: (responsableToEdit.cirun || "").trim(),
        codigoAmbiente: (responsableToEdit.codigoAmbiente || "").trim(),
        nombre1: (responsableToEdit.nombre1 || "").trim(),
        nombre2: (responsableToEdit.nombre2 || "").trim(),
        paterno: (responsableToEdit.paterno || "").trim(),
        materno: (responsableToEdit.materno || "").trim(),
        estado: responsableToEdit.estado != null ? String(responsableToEdit.estado) : "",
        autoriza: responsableToEdit.autoriza != null ? String(responsableToEdit.autoriza) : "",
        cargo: (responsableToEdit.cargo || "").trim(),
        loginSid: responsableToEdit.loginSid || "",
        usuarioRegistro: (responsableToEdit.usuarioRegistro || "").trim(),
        fechaRegistro: parseDate(responsableToEdit.fechaRegistro),
        registroActivo: responsableToEdit.registroActivo != null ? String(responsableToEdit.registroActivo) : "",
      });
      setErrors({});
    } else {
      setFormData(INITIAL_STATE);
      setErrors({});
    }
  }, [responsableToEdit]);

  const validateForm = (data) => {
    const newErrors = {};
    if (!data.nombre1.trim()) {
      newErrors.nombre1 = "El primer nombre es requerido";
    }
    if (!data.cirun.trim()) {
      newErrors.cirun = "El CI es requerido";
    }
    return newErrors;
  };

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
    if (errors[id]) {
      setErrors((prev) => ({ ...prev, [id]: "" }));
    }
  };

  const handleSelectChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const submitData = { ...formData };
      const fieldsToNullify = ["fechaRegistro"];
      fieldsToNullify.forEach((field) => {
        if (submitData[field] === "") {
          submitData[field] = null;
        }
      });
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cirun">CI (RUT)</Label>
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
          <Label htmlFor="codigoAmbiente">Código Ambiente</Label>
          <Input
            id="codigoAmbiente"
            value={formData.codigoAmbiente}
            onChange={handleChange}
            placeholder="ej: 0"
            disabled={isSubmitting}
            maxLength={20}
          />
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
              {ESTADO_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="autoriza">Autoriza</Label>
          <Select
            value={formData.autoriza}
            onValueChange={(value) => handleSelectChange("autoriza", value)}
            disabled={isSubmitting}
          >
            <SelectTrigger className="w-full [&>span]:line-clamp-1 text-left">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {SI_NO_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="registroActivo">Registro Activo</Label>
          <Select
            value={formData.registroActivo}
            onValueChange={(value) => handleSelectChange("registroActivo", value)}
            disabled={isSubmitting}
          >
            <SelectTrigger className="w-full [&>span]:line-clamp-1 text-left">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {ESTADO_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="loginSid">Login SID</Label>
          <Input
            id="loginSid"
            value={formData.loginSid}
            onChange={handleChange}
            placeholder="SID de login"
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="usuarioRegistro">Usuario Registro</Label>
          <Input
            id="usuarioRegistro"
            value={formData.usuarioRegistro}
            onChange={handleChange}
            placeholder="ej: usrartemisa"
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
        <div className="space-y-2">
          <Label htmlFor="fechaRegistro">Fecha de Registro</Label>
          <Input
            id="fechaRegistro"
            type="date"
            value={formData.fechaRegistro}
            onChange={handleChange}
            disabled={isSubmitting}
          />
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
          disabled={isSubmitting || !formData.nombre1.trim() || !formData.cirun.trim()}
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

export default ResponsableForm;
