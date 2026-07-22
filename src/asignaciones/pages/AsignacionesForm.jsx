import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ComboboxField from "@/components/ui/combobox-field";

const INITIAL_STATE = {
  activoId: "",
  funcionarioId: "",
  entidadId: "",
  unidadId: "",
  ubicacionId: "",
  fechaAsignacion: "",
  activa: "true",
};

const AsignacionesForm = ({
  asignacionToEdit,
  onSubmit,
  onCancel,
  activos,
  funcionarios,
  entidades,
  unidades,
  ubicaciones,
  loadingFK,
}) => {
  const [formData, setFormData] = useState(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (asignacionToEdit) {
      setFormData({
        activoId: asignacionToEdit.activoId?.toString() || "",
        funcionarioId: asignacionToEdit.funcionarioId?.toString() || "",
        entidadId: asignacionToEdit.entidadId?.toString() || "",
        unidadId: asignacionToEdit.unidadId?.toString() || "",
        ubicacionId: asignacionToEdit.ubicacionId?.toString() || "",
        fechaAsignacion: asignacionToEdit.fechaAsignacion || "",
        activa: asignacionToEdit.activa !== false ? "true" : "false",
      });
      setErrors({});
    } else {
      setFormData(INITIAL_STATE);
      setErrors({});
    }
  }, [asignacionToEdit]);

  const validateForm = (data) => {
    const newErrors = {};
    if (!data.activoId) newErrors.activoId = "El activo es requerido";
    if (!data.funcionarioId) newErrors.funcionarioId = "El funcionario es requerido";
    if (!data.entidadId) newErrors.entidadId = "La entidad es requerida";
    if (!data.fechaAsignacion) newErrors.fechaAsignacion = "La fecha de asignación es requerida";
    return newErrors;
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
      const submitData = {
        activoId: formData.activoId ? parseInt(formData.activoId) : null,
        funcionarioId: formData.funcionarioId ? parseInt(formData.funcionarioId) : null,
        entidadId: formData.entidadId ? parseInt(formData.entidadId) : null,
        unidadId: formData.unidadId ? parseInt(formData.unidadId) : null,
        ubicacionId: formData.ubicacionId ? parseInt(formData.ubicacionId) : null,
        fechaAsignacion: formData.fechaAsignacion || null,
        activa: formData.activa === "true",
      };

      if (!asignacionToEdit) {
        submitData.movimientoAsigId = 1;
      }

      const success = await onSubmit(submitData);
      if (!success) {
        setIsSubmitting(false);
        return;
      }
    } catch (error) {
      console.error("Error en el formulario de asignación:", error);
      setErrors({ general: "Error inesperado al guardar la asignación" });
      setIsSubmitting(false);
    }
  };

  const activoOptions = activos.map((a) => ({
    value: a.id.toString(),
    label: `${a.codigo_patrimonial} - ${a.denominacion}`,
  }));

  const funcionarioOptions = funcionarios.map((f) => ({
    value: f.id.toString(),
    label: `${f.nombres} ${f.apellido_paterno} ${f.apellido_materno || ""}`.trim(),
  }));

  const entidadOptions = entidades.map((e) => ({
    value: e.id.toString(),
    label: e.nombre,
  }));

  const unidadOptions = unidades.map((u) => ({
    value: u.id.toString(),
    label: u.nombre,
  }));

  const ubicacionOptions = ubicaciones.map((u) => ({
    value: u.id.toString(),
    label: u.nombre,
  }));

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ComboboxField
          label="Activo Fijo"
          value={formData.activoId}
          onValueChange={(value) => handleSelectChange("activoId", value)}
          options={activoOptions}
          placeholder="Seleccionar activo"
          searchPlaceholder="Buscar activo..."
          loading={loadingFK}
          disabled={isSubmitting}
          error={errors.activoId}
        />

        <ComboboxField
          label="Funcionario"
          value={formData.funcionarioId}
          onValueChange={(value) => handleSelectChange("funcionarioId", value)}
          options={funcionarioOptions}
          placeholder="Seleccionar funcionario"
          searchPlaceholder="Buscar funcionario..."
          loading={loadingFK}
          disabled={isSubmitting}
          error={errors.funcionarioId}
        />

        <ComboboxField
          label="Entidad"
          value={formData.entidadId}
          onValueChange={(value) => handleSelectChange("entidadId", value)}
          options={entidadOptions}
          placeholder="Seleccionar entidad"
          searchPlaceholder="Buscar entidad..."
          loading={loadingFK}
          disabled={isSubmitting}
          error={errors.entidadId}
        />

        <ComboboxField
          label="Unidad"
          value={formData.unidadId}
          onValueChange={(value) => handleSelectChange("unidadId", value)}
          options={unidadOptions}
          placeholder="Seleccionar unidad"
          searchPlaceholder="Buscar unidad..."
          loading={loadingFK}
          disabled={isSubmitting}
        />

        <ComboboxField
          label="Ubicación"
          value={formData.ubicacionId}
          onValueChange={(value) => handleSelectChange("ubicacionId", value)}
          options={ubicacionOptions}
          placeholder="Seleccionar ubicación"
          searchPlaceholder="Buscar ubicación..."
          loading={loadingFK}
          disabled={isSubmitting}
        />

        <div className="space-y-2">
          <Label htmlFor="fechaAsignacion">Fecha de Asignación</Label>
          <Input
            id="fechaAsignacion"
            type="date"
            value={formData.fechaAsignacion}
            onChange={(e) => handleSelectChange("fechaAsignacion", e.target.value)}
            disabled={isSubmitting}
            className={errors.fechaAsignacion ? "border-red-500" : ""}
          />
          {errors.fechaAsignacion && <p className="text-sm text-red-500">{errors.fechaAsignacion}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="activa">Estado</Label>
          <select
            id="activa"
            value={formData.activa}
            onChange={(e) => handleSelectChange("activa", e.target.value)}
            disabled={isSubmitting}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="true">ACTIVO</option>
            <option value="false">BAJA</option>
          </select>
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
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "Procesando..."
            : asignacionToEdit
            ? "Actualizar"
            : "Guardar"}
        </Button>
      </div>
    </form>
  );
};

export default AsignacionesForm;
