import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
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
  tiporubroact: "",
  descripciontiporubroact: "",
  codigorubroact: "",
  estado: "",
  login_sid: "",
};

const TipoRubroForm = ({ tiporubroToEdit, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [rubros, setRubros] = useState([]);
  const [loadingRubros, setLoadingRubros] = useState(false);

  useEffect(() => {
    setLoadingRubros(true);
    supabase
      .from("act_rubro")
      .select("codigorubroact, descripcionrubroact")
      .order("descripcionrubroact", { ascending: true })
      .then(({ data, error }) => {
        if (!error) setRubros(data || []);
        setLoadingRubros(false);
      });
  }, []);

  useEffect(() => {
    if (tiporubroToEdit) {
      setFormData({
        tiporubroact: tiporubroToEdit.tiporubroact != null ? String(tiporubroToEdit.tiporubroact) : "",
        descripciontiporubroact: (tiporubroToEdit.descripciontiporubroact || "").trim(),
        codigorubroact: tiporubroToEdit.codigorubroact != null ? String(tiporubroToEdit.codigorubroact) : "",
        estado: tiporubroToEdit.estado != null ? String(tiporubroToEdit.estado) : "",
        login_sid: tiporubroToEdit.login_sid || "",
      });
    } else {
      setFormData(INITIAL_STATE);
    }
    setErrors({});
  }, [tiporubroToEdit]);

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
    if (!formData.descripciontiporubroact.trim()) newErrors.descripciontiporubroact = "La descripción del tipo de rubro es requerida";
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setIsSubmitting(true);
    try {
      const submitData = { ...formData };
      ["tiporubroact", "codigorubroact", "estado"].forEach(f => { if (submitData[f] === "") submitData[f] = null; });
      const success = await onSubmit(submitData);
      if (!success) setIsSubmitting(false);
    } catch {
      setErrors({ general: "Error inesperado" });
      setIsSubmitting(false);
    }
  };

  const isEditing = Boolean(tiporubroToEdit);

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 py-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="tiporubroact">Código Tipo Rubro</Label>
          <Input
            id="tiporubroact"
            type="number"
            value={formData.tiporubroact}
            onChange={handleChange}
            placeholder="ej: 1"
            disabled={isSubmitting || isEditing}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="descripciontiporubroact">Descripción Tipo Rubro</Label>
          <Input
            id="descripciontiporubroact"
            value={formData.descripciontiporubroact}
            onChange={handleChange}
            placeholder="ej: Sillas"
            required
            disabled={isSubmitting}
            className={errors.descripciontiporubroact ? "border-red-500" : ""}
          />
          {errors.descripciontiporubroact && <p className="text-sm text-red-500">{errors.descripciontiporubroact}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="codigorubroact">Rubro</Label>
        {loadingRubros ? (
          <div className="h-10 w-full animate-pulse bg-slate-100 rounded border flex items-center px-3 text-muted-foreground text-sm">Cargando...</div>
        ) : (
          <Select
            value={formData.codigorubroact}
            onValueChange={(value) => handleSelectChange("codigorubroact", value)}
            disabled={isSubmitting}
          >
            <SelectTrigger className="w-full [&>span]:line-clamp-1 text-left">
              <SelectValue placeholder="Seleccionar rubro" />
            </SelectTrigger>
            <SelectContent>
              {rubros.map(r => (
                <SelectItem key={r.codigorubroact} value={String(r.codigorubroact)}>
                  {r.descripcionrubroact}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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
        <Button type="submit" disabled={isSubmitting || !formData.descripciontiporubroact.trim()}>
          {isSubmitting ? "Procesando..." : tiporubroToEdit ? "Actualizar" : "Guardar"}
        </Button>
      </div>
    </form>
  );
};

export default TipoRubroForm;
