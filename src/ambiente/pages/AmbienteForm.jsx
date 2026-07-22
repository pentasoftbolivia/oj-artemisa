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
  codigoambiente: "",
  ambiente: "",
  codigonivel: "",
  estado: "",
  codigoinstitucion: "",
  login_sid: "",
  usuarioregistro: "",
  fecharegistro: "",
  registroactivo: "",
};

const AmbienteForm = ({ ambienteToEdit, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (ambienteToEdit) {
      setFormData({
        codigoambiente: (ambienteToEdit.codigoambiente || "").trim(),
        ambiente: (ambienteToEdit.ambiente || "").trim(),
        codigonivel: (ambienteToEdit.codigonivel || "").trim(),
        estado: ambienteToEdit.estado != null ? String(ambienteToEdit.estado) : "",
        codigoinstitucion: (ambienteToEdit.codigoinstitucion || "").trim(),
        login_sid: ambienteToEdit.login_sid || "",
        usuarioregistro: ambienteToEdit.usuarioregistro || "",
        fecharegistro: ambienteToEdit.fecharegistro || "",
        registroactivo: ambienteToEdit.registroactivo != null ? String(ambienteToEdit.registroactivo) : "",
      });
    } else {
      setFormData(INITIAL_STATE);
    }
    setErrors({});
  }, [ambienteToEdit]);

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
    if (!formData.ambiente.trim()) newErrors.ambiente = "El nombre del ambiente es requerido";
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setIsSubmitting(true);
    try {
      const submitData = { ...formData };
      ["estado", "registroactivo"].forEach(f => { if (submitData[f] === "") submitData[f] = null; });
      const success = await onSubmit(submitData);
      if (!success) setIsSubmitting(false);
    } catch {
      setErrors({ general: "Error inesperado" });
      setIsSubmitting(false);
    }
  };

  const isEditing = Boolean(ambienteToEdit);

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 py-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="codigoambiente">Código Ambiente</Label>
          <Input
            id="codigoambiente"
            value={formData.codigoambiente}
            onChange={handleChange}
            placeholder="ej: AMB-001"
            disabled={isSubmitting || isEditing}
            maxLength={20}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ambiente">Ambiente</Label>
          <Input
            id="ambiente"
            value={formData.ambiente}
            onChange={handleChange}
            placeholder="ej: Sala de Juntas"
            required
            disabled={isSubmitting}
            className={errors.ambiente ? "border-red-500" : ""}
          />
          {errors.ambiente && <p className="text-sm text-red-500">{errors.ambiente}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="codigonivel">Código Nivel</Label>
          <Input
            id="codigonivel"
            value={formData.codigonivel}
            onChange={handleChange}
            placeholder="ej: NIV-01"
            disabled={isSubmitting}
            maxLength={20}
          />
        </div>

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
          <Label htmlFor="registroactivo">Registro Activo</Label>
          <Select
            value={formData.registroactivo}
            onValueChange={(value) => handleSelectChange("registroactivo", value)}
            disabled={isSubmitting}
          >
            <SelectTrigger className="w-full [&>span]:line-clamp-1 text-left">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Sí</SelectItem>
              <SelectItem value="0">No</SelectItem>
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

      {!isEditing && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="usuarioregistro">Usuario Registro</Label>
            <Input
              id="usuarioregistro"
              value={formData.usuarioregistro}
              onChange={handleChange}
              placeholder="Usuario que registra"
              disabled={isSubmitting}
              maxLength={50}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fecharegistro">Fecha Registro</Label>
            <Input
              id="fecharegistro"
              type="datetime-local"
              value={formData.fecharegistro}
              onChange={handleChange}
              disabled={isSubmitting}
            />
          </div>
        </div>
      )}

      {errors.general && <div className="text-sm text-white text-center p-3 bg-red-600 rounded">{errors.general}</div>}
      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancelar</Button>
        <Button type="submit" disabled={isSubmitting || !formData.ambiente.trim()}>
          {isSubmitting ? "Procesando..." : ambienteToEdit ? "Actualizar" : "Guardar"}
        </Button>
      </div>
    </form>
  );
};

export default AmbienteForm;
