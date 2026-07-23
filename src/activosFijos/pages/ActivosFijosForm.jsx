import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const INITIAL_STATE = {
  codigoActivoInterno: "",
  descripcionActivo: "",
  codigoActivo: "",
  codigoAmbiente: "",
  cirun: "",
  tipoRubroAct: "",
  serie: "",
  marcaMaterial: "",
  estado: "",
  valorInicial: "",
  observaciones: "",
};

const ActivosFijosForm = ({ activoToEdit, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [ambientes, setAmbientes] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [tipoRubros, setTipoRubros] = useState([]);
  const [loadingFK, setLoadingFK] = useState(false);

  useEffect(() => {
    setLoadingFK(true);
    Promise.all([
      supabase.from("act_ambiente").select("codigoambiente, ambiente").order("ambiente", { ascending: true }),
      supabase.from("funcionario").select("cirun, nombres, paterno, materno").order("nombres", { ascending: true }),
      supabase.from("act_tiporubro").select("tiporubroact, descripciontiporubroact").order("descripciontiporubroact", { ascending: true }),
    ]).then(([amb, fun, tr]) => {
      if (!amb.error) setAmbientes(amb.data || []);
      if (!fun.error) setFuncionarios(fun.data || []);
      if (!tr.error) setTipoRubros(tr.data || []);
      setLoadingFK(false);
    });
  }, []);

  useEffect(() => {
    if (activoToEdit) {
      setFormData({
        codigoActivoInterno: activoToEdit.codigoActivoInterno != null ? String(activoToEdit.codigoActivoInterno) : "",
        descripcionActivo: (activoToEdit.descripcionActivo || "").trim(),
        codigoActivo: activoToEdit.codigoActivo != null ? String(activoToEdit.codigoActivo) : "",
        codigoAmbiente: String(activoToEdit.codigoAmbiente ?? activoToEdit.codigoambiente ?? "").trim(),
        cirun: normalizeCi(activoToEdit.cirun),
        tipoRubroAct: activoToEdit.tipoRubroAct != null ? String(activoToEdit.tipoRubroAct) : "",
        serie: (activoToEdit.serie || "").trim(),
        marcaMaterial: (activoToEdit.marcaMaterial || "").trim(),
        estado: activoToEdit.estado != null ? String(activoToEdit.estado) : "",
        valorInicial: activoToEdit.valorInicial != null ? String(activoToEdit.valorInicial) : "",
        observaciones: (activoToEdit.observaciones || "").trim(),
      });
    } else {
      setFormData(INITIAL_STATE);
    }
    setErrors({});
  }, [activoToEdit]);

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
    if (!formData.descripcionActivo.trim()) newErrors.descripcionActivo = "La descripción del activo es requerida";
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setIsSubmitting(true);
    try {
      const submitData = { ...formData };
      ["codigoActivoInterno", "codigoActivo", "tipoRubroAct", "estado", "valorInicial"].forEach(f => {
        if (submitData[f] === "") submitData[f] = null;
      });
      if (submitData.valorInicial != null) submitData.valorInicial = Number(submitData.valorInicial);
      const success = await onSubmit(submitData);
      if (!success) setIsSubmitting(false);
    } catch {
      setErrors({ general: "Error inesperado" });
      setIsSubmitting(false);
    }
  };

  const isEditing = Boolean(activoToEdit);

  const normalizeCi = (v) => String(v ?? "").replace(/[^\d]/g, "");
  const formatFuncionario = (f) => {
    const parts = [f.nombres, f.paterno, f.materno].filter(Boolean).map(s => (s || "").trim());
    return parts.join(" ") || f.cirun;
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="codigoActivoInterno">Código Interno</Label>
          <Input id="codigoActivoInterno" type="number" value={formData.codigoActivoInterno} onChange={handleChange} placeholder="ej: 226689" disabled={isSubmitting || isEditing} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="codigoActivo">Código Activo</Label>
          <Input id="codigoActivo" type="number" value={formData.codigoActivo} onChange={handleChange} placeholder="ej: 1" disabled={isSubmitting} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="descripcionActivo">Descripción del Activo</Label>
        <Input id="descripcionActivo" value={formData.descripcionActivo} onChange={handleChange} placeholder="ej: SILLON EJECUTIVO, REVESTIDO CUERINA NEGRA" required disabled={isSubmitting}
          className={errors.descripcionActivo ? "border-red-500" : ""} />
        {errors.descripcionActivo && <p className="text-sm text-red-500">{errors.descripcionActivo}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="codigoAmbiente">Ambiente</Label>
          <Select
            key={`amb-${formData.codigoAmbiente}-${ambientes.length}`}
            value={formData.codigoAmbiente}
            onValueChange={(value) => handleSelectChange("codigoAmbiente", value)}
            disabled={isSubmitting || loadingFK}
          >
            <SelectTrigger className="w-full [&>span]:line-clamp-1 text-left">
              <SelectValue placeholder="Seleccionar ambiente" />
            </SelectTrigger>
            <SelectContent>
              {ambientes.map(a => (
                <SelectItem key={a.codigoambiente} value={String(a.codigoambiente).trim()}>
                  {`${(a.codigoambiente || "").trim()} - ${(a.ambiente || "").trim()}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cirun">Funcionario (CI)</Label>
          <Select
            key={`fun-${formData.cirun}-${funcionarios.length}`}
            value={formData.cirun}
            onValueChange={(value) => handleSelectChange("cirun", normalizeCi(value))}
            disabled={isSubmitting || loadingFK}
          >
            <SelectTrigger className="w-full [&>span]:line-clamp-1 text-left">
              <SelectValue placeholder="Seleccionar funcionario" />
            </SelectTrigger>
            <SelectContent>
              {funcionarios.map(f => (
                <SelectItem key={f.cirun} value={normalizeCi(f.cirun)}>
                  {`${normalizeCi(f.cirun)} - ${formatFuncionario(f)}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

        </div>
        <div className="space-y-2">
          <Label htmlFor="tipoRubroAct">Tipo Rubro</Label>
          <Select
            key={`tr-${formData.tipoRubroAct}-${tipoRubros.length}`}
            value={formData.tipoRubroAct}
            onValueChange={(value) => handleSelectChange("tipoRubroAct", value)}
            disabled={isSubmitting || loadingFK}
          >
            <SelectTrigger className="w-full [&>span]:line-clamp-1 text-left">
              <SelectValue placeholder="Seleccionar tipo rubro" />
            </SelectTrigger>
            <SelectContent>
              {tipoRubros.map(t => (
                <SelectItem key={t.tiporubroact} value={String(t.tiporubroact)}>
                  {`${t.tiporubroact} - ${(t.descripciontiporubroact || "").trim()}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="serie">Serie</Label>
          <Input id="serie" value={formData.serie} onChange={handleChange} placeholder="Número de serie" disabled={isSubmitting} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="marcaMaterial">Marca / Material</Label>
          <Input id="marcaMaterial" value={formData.marcaMaterial} onChange={handleChange} placeholder="Marca o material del activo" disabled={isSubmitting} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="valorInicial">Valor Inicial (Bs)</Label>
          <Input id="valorInicial" type="number" step="0.01" value={formData.valorInicial} onChange={handleChange} placeholder="0.00" disabled={isSubmitting} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="estado">Estado</Label>
          <Select value={formData.estado} onValueChange={(value) => handleSelectChange("estado", value)} disabled={isSubmitting}>
            <SelectTrigger className="w-full [&>span]:line-clamp-1 text-left">
              <SelectValue placeholder="Seleccionar estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Activo</SelectItem>
              <SelectItem value="0">Inactivo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="observaciones">Observaciones</Label>
        <Textarea id="observaciones" value={formData.observaciones} onChange={handleChange} placeholder="Observaciones adicionales" disabled={isSubmitting} rows={2} />
      </div>

      {errors.general && <div className="text-sm text-white text-center p-3 bg-red-600 rounded">{errors.general}</div>}

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancelar</Button>
        <Button type="submit" disabled={isSubmitting || !formData.descripcionActivo.trim()}>
          {isSubmitting ? "Procesando..." : activoToEdit ? "Actualizar" : "Guardar"}
        </Button>
      </div>
    </form>
  );
};

export default ActivosFijosForm;
