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
  codigo: "",
  paterno: "",
  materno: "",
  nombres: "",
  ciexp: "",
  dirz: "",
  dirc: "",
  fecnac: "",
  tel: "",
  cel: "",
  ec: "",
  ts: "",
  sexo: "",
  nac: "",
  ln: "",
  lm: "",
  cba: "",
  banco: "",
  acaja: "",
  afp: "",
  mat: "",
  fsys: "",
};

const EC_OPTIONS = [
  { value: "S", label: "Soltero" },
  { value: "C", label: "Casado" },
  { value: "D", label: "Divorciado" },
  { value: "V", label: "Viudo" },
];

const SEXO_OPTIONS = [
  { value: "M", label: "Masculino" },
  { value: "F", label: "Femenino" },
];

const TS_OPTIONS = [
  { value: "0", label: "No especificado" },
  { value: "1", label: "O+" },
  { value: "2", label: "O-" },
  { value: "3", label: "A+" },
  { value: "4", label: "A-" },
  { value: "5", label: "B+" },
  { value: "6", label: "B-" },
  { value: "7", label: "AB+" },
  { value: "8", label: "AB-" },
];

const parseDate = (val) => {
  if (!val) return "";
  try {
    return val.substring(0, 10);
  } catch {
    return "";
  }
};

const FuncionarioForm = ({ funcionarioToEdit, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (funcionarioToEdit) {
      setFormData({
        cirun: (funcionarioToEdit.cirun || "").trim(),
        codigo: (funcionarioToEdit.codigo || "").trim(),
        paterno: (funcionarioToEdit.paterno || "").trim(),
        materno: (funcionarioToEdit.materno || "").trim(),
        nombres: (funcionarioToEdit.nombres || "").trim(),
        ciexp: (funcionarioToEdit.ciexp || "").trim(),
        dirz: (funcionarioToEdit.dirz || "").trim(),
        dirc: (funcionarioToEdit.dirc || "").trim(),
        fecnac: parseDate(funcionarioToEdit.fecnac),
        tel: (funcionarioToEdit.tel || "").trim(),
        cel: (funcionarioToEdit.cel || "").trim(),
        ec: funcionarioToEdit.ec || "",
        ts: funcionarioToEdit.ts != null ? String(funcionarioToEdit.ts) : "",
        sexo: funcionarioToEdit.sexo || "",
        nac: (funcionarioToEdit.nac || "").trim(),
        ln: (funcionarioToEdit.ln || "").trim(),
        lm: (funcionarioToEdit.lm || "").trim(),
        cba: (funcionarioToEdit.cba || "").trim(),
        banco: (funcionarioToEdit.banco || "").trim(),
        acaja: funcionarioToEdit.acaja != null ? String(funcionarioToEdit.acaja) : "",
        afp: (funcionarioToEdit.afp || "").trim(),
        mat: funcionarioToEdit.mat != null ? String(funcionarioToEdit.mat) : "",
        fsys: funcionarioToEdit.fsys || "",
      });
      setErrors({});
    } else {
      setFormData(INITIAL_STATE);
      setErrors({});
    }
  }, [funcionarioToEdit]);

  const validateForm = (data) => {
    const newErrors = {};
    if (!data.nombres.trim()) {
      newErrors.nombres = "Los nombres son requeridos";
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
      const fieldsToNullify = ["fecnac", "ts", "acaja", "mat"];
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
      console.error("Error en el formulario de funcionario:", error);
      setErrors({ general: "Error inesperado al guardar el funcionario" });
      setIsSubmitting(false);
    }
  };

  const isEditing = Boolean(funcionarioToEdit);

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cirun">Cédula de Identidad (RUT)</Label>
          <Input
            id="cirun"
            value={formData.cirun}
            onChange={handleChange}
            placeholder="ej: 1000043"
            disabled={isSubmitting || isEditing}
            maxLength={20}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="codigo">Código Interno</Label>
          <Input
            id="codigo"
            value={formData.codigo}
            onChange={handleChange}
            placeholder="ej: F47C0"
            disabled={isSubmitting}
            maxLength={10}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ciexp">CI Expedido en</Label>
          <Input
            id="ciexp"
            value={formData.ciexp}
            onChange={handleChange}
            placeholder="ej: LP, CH, etc."
            disabled={isSubmitting}
            maxLength={10}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <Label htmlFor="nombres">Nombres</Label>
          <Input
            id="nombres"
            value={formData.nombres}
            onChange={handleChange}
            placeholder="ej: JUAN CARLOS"
            required
            disabled={isSubmitting}
            className={errors.nombres ? "border-red-500" : ""}
          />
          {errors.nombres && <p className="text-sm text-red-500">{errors.nombres}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sexo">Sexo</Label>
          <Select
            value={formData.sexo}
            onValueChange={(value) => handleSelectChange("sexo", value)}
            disabled={isSubmitting}
          >
            <SelectTrigger className="w-full [&>span]:line-clamp-1 text-left">
              <SelectValue placeholder="Seleccionar sexo" />
            </SelectTrigger>
            <SelectContent>
              {SEXO_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ec">Estado Civil</Label>
          <Select
            value={formData.ec}
            onValueChange={(value) => handleSelectChange("ec", value)}
            disabled={isSubmitting}
          >
            <SelectTrigger className="w-full [&>span]:line-clamp-1 text-left">
              <SelectValue placeholder="Seleccionar estado civil" />
            </SelectTrigger>
            <SelectContent>
              {EC_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ts">Tipo de Sangre</Label>
          <Select
            value={formData.ts}
            onValueChange={(value) => handleSelectChange("ts", value)}
            disabled={isSubmitting}
          >
            <SelectTrigger className="w-full [&>span]:line-clamp-1 text-left">
              <SelectValue placeholder="Seleccionar tipo" />
            </SelectTrigger>
            <SelectContent>
              {TS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nac">Nacionalidad</Label>
          <Input
            id="nac"
            value={formData.nac}
            onChange={handleChange}
            placeholder="ej: BOLIVIANA"
            disabled={isSubmitting}
            maxLength={50}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fecnac">Fecha de Nacimiento</Label>
          <Input
            id="fecnac"
            type="date"
            value={formData.fecnac}
            onChange={handleChange}
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ln">Lugar de Nacimiento</Label>
          <Input
            id="ln"
            value={formData.ln}
            onChange={handleChange}
            placeholder="ej: SUCRE"
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="dirz">Dirección Zona</Label>
          <Input
            id="dirz"
            value={formData.dirz}
            onChange={handleChange}
            placeholder="Zona/Barrio"
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dirc">Dirección Ciudad</Label>
          <Input
            id="dirc"
            value={formData.dirc}
            onChange={handleChange}
            placeholder="Calle y número"
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="tel">Teléfono</Label>
          <Input
            id="tel"
            value={formData.tel}
            onChange={handleChange}
            placeholder="ej: 22456789"
            disabled={isSubmitting}
            maxLength={20}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cel">Celular</Label>
          <Input
            id="cel"
            value={formData.cel}
            onChange={handleChange}
            placeholder="ej: 71234567"
            disabled={isSubmitting}
            maxLength={20}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="lm">Lugar de Matrimonio</Label>
          <Input
            id="lm"
            value={formData.lm}
            onChange={handleChange}
            placeholder="Lugar de matrimonio"
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cba">Cuenta Bancaria</Label>
          <Input
            id="cba"
            value={formData.cba}
            onChange={handleChange}
            placeholder="Número de cuenta"
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="banco">Banco</Label>
          <Input
            id="banco"
            value={formData.banco}
            onChange={handleChange}
            placeholder="Nombre del banco"
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="acaja">Aportes Caja</Label>
          <Select
            value={formData.acaja}
            onValueChange={(value) => handleSelectChange("acaja", value)}
            disabled={isSubmitting}
          >
            <SelectTrigger className="w-full [&>span]:line-clamp-1 text-left">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">No</SelectItem>
              <SelectItem value="1">Sí</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="afp">AFP</Label>
          <Input
            id="afp"
            value={formData.afp}
            onChange={handleChange}
            placeholder="AFP"
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mat">Matrícula</Label>
          <Input
            id="mat"
            value={formData.mat}
            onChange={handleChange}
            placeholder="Número de matrícula"
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fsys">Fecha Sistema</Label>
          <Input
            id="fsys"
            value={formData.fsys}
            onChange={handleChange}
            disabled
            className="bg-muted"
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
          disabled={isSubmitting || !formData.nombres.trim()}
        >
          {isSubmitting
            ? "Procesando..."
            : funcionarioToEdit
            ? "Actualizar"
            : "Guardar"}
        </Button>
      </div>
    </form>
  );
};

export default FuncionarioForm;
