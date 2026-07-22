import { useEffect, useMemo, useState, useRef } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { createLookupMap, createOptionsList } from "@/lib/utils";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import ComboboxField from "@/components/ui/combobox-field";
import {
  Plus,
  X,
  Edit,
  Pencil,
  Trash2,
  Camera,
  Eye,
  Trash,
  Search,
} from "lucide-react";
import {
  getImagenesByDetalleId,
  deleteImagen,
} from "@/services/movimientosService";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ESTADO_MOVIMIENTO_OPTIONS = [
  "BORRADOR",
  "ASIGNADO",
  "APROBADO",
  "RECHAZADO",
];

const LocalImagePreview = ({ file, onRemove }) => {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!url) return null;

  return (
    <div className="relative group rounded-md overflow-hidden border border-green-500">
      <img src={url} alt="Local" className="w-full h-40 object-cover" />
      <div className="absolute top-2 right-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <Button
          type="button"
          size="sm"
          variant="destructive"
          onClick={onRemove}
        >
          <Trash className="h-4 w-4" />
        </Button>
      </div>
      <div className="absolute bottom-0 w-full bg-green-600/80 text-white text-[10px] text-center p-1">
        Pendiente (Local)
      </div>
    </div>
  );
};

// Esquema Zod para validación
const detalleSchema = z.object({
  activo_id: z.string().min(1, "Seleccione un activo"),
  estado_activo_anterior: z.string().optional().nullable(),
  estado_activo_nuevo: z.string().optional().nullable(),
  condicion_anterior: z.string().optional().nullable(),
  condicion_nueva: z.string().optional().nullable(),
  observaciones: z.string().optional().nullable(),
  imagenes_adjuntas: z.any().optional(),
});

const formSchema = z
  .object({
    tipo_movimiento_id: z
      .string()
      .min(1, "Debe seleccionar un tipo de movimiento"),
    numero_documento: z.string().optional().nullable(),
    fecha_movimiento: z.string().min(1, "La fecha es requerida"),
    fecha_aprobacion: z.string().optional().nullable(),
    numero_acta: z.string().optional().nullable(),
    numero_resolucion: z.string().optional().nullable(),
    estado_movimiento: z.string(),
    funcionario_origen_id: z.string().optional().nullable(),
    funcionario_destino_id: z.string().optional().nullable(),
    ubicacion_origen_id: z.string().optional().nullable(),
    ubicacion_destino_id: z.string().optional().nullable(),
    aprobado_por_id: z.string().optional().nullable(),
    motivo: z.string().optional().nullable(),
    observaciones: z.string().optional().nullable(),
    detalles: z
      .array(detalleSchema)
      .min(1, "Debe agregar al menos un detalle de activo"),
  })
  .refine(
    (data) => {
      return data.funcionario_origen_id || data.funcionario_destino_id;
    },
    {
      message: "Debe especificar al menos un funcionario (origen o destino)",
      path: ["funcionario_destino_id"], // Muestra el error en este campo
    },
  );

const DETALLE_INITIAL = {
  activo_id: "",
  estado_activo_anterior: "",
  estado_activo_nuevo: "",
  condicion_nueva: "",
  observaciones: "",
};

const MovimientosForm = ({
  movimientoToEdit,
  initialDetalles,
  onSubmit,
  onCancel,
  tiposMovimiento,
  funcionarios,
  ubicaciones,
  activos,
  estadosActivo,
  loadingFK,
  toast,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [detalleTemporal, setDetalleTemporal] = useState({
    ...DETALLE_INITIAL,
  });
  const [editingDetalleIndex, setEditingDetalleIndex] = useState(null);
  const [numeroPatrimonial, setNumeroPatrimonial] = useState("");

  const defaultValues = useMemo(() => {
    if (movimientoToEdit) {
      return {
        tipo_movimiento_id:
          movimientoToEdit.tipo_movimiento_id?.toString() || "",
        fecha_movimiento:
          movimientoToEdit.fecha_movimiento ||
          new Date().toISOString().split("T")[0],
        fecha_aprobacion: movimientoToEdit.fecha_aprobacion || "",
        numero_acta: movimientoToEdit.numero_acta || "",
        numero_resolucion: movimientoToEdit.numero_resolucion || "",
        estado_movimiento: movimientoToEdit.estado_movimiento || "BORRADOR",
        funcionario_origen_id:
          movimientoToEdit.funcionario_origen_id?.toString() || "",
        funcionario_destino_id:
          movimientoToEdit.funcionario_destino_id?.toString() || "",
        ubicacion_origen_id:
          movimientoToEdit.ubicacion_origen_id?.toString() || "",
        ubicacion_destino_id:
          movimientoToEdit.ubicacion_destino_id?.toString() || "",
        aprobado_por_id: movimientoToEdit.aprobado_por_id?.toString() || "",
        motivo: movimientoToEdit.motivo || "",
        observaciones: movimientoToEdit.observaciones || "",
        numero_documento: movimientoToEdit.numero_documento || "",
        detalles: (initialDetalles || []).map((d) => ({
          activo_id: d.activo_id?.toString() || "",
          estado_activo_anterior: d.estado_activo_anterior?.toString() || "",
          estado_activo_nuevo: d.estado_activo_nuevo?.toString() || "",
          condicion_anterior: d.condicion_anterior || "",
          condicion_nueva: d.condicion_nueva || "",
          observaciones: d.observaciones || "",
        })),
      };
    }
    return {
      tipo_movimiento_id: "",
      fecha_movimiento: new Date().toISOString().split("T")[0],
      fecha_aprobacion: "",
      numero_acta: "",
      numero_resolucion: "",
      estado_movimiento: "BORRADOR",
      funcionario_origen_id: "",
      funcionario_destino_id: "",
      ubicacion_origen_id: "",
      ubicacion_destino_id: "",
      aprobado_por_id: "",
      motivo: "",
      observaciones: "",
      numero_documento: "",
      detalles: [],
    };
  }, [movimientoToEdit, initialDetalles]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const watchNumeroDocumento = watch("numero_documento");

  useEffect(() => {
    if (watchNumeroDocumento && watchNumeroDocumento.trim() !== "") {
      const targetDoc = watchNumeroDocumento.trim();
      const funcMatch = funcionarios.find(
        (f) =>
          f.numeroDocumento === targetDoc || f.numero_documento === targetDoc,
      );
      if (funcMatch) {
        setValue("funcionario_destino_id", funcMatch.id.toString(), {
          shouldValidate: true,
        });
      }
    }
  }, [watchNumeroDocumento, funcionarios, setValue]);

  const { fields, append, remove, update, replace } = useFieldArray({
    control,
    name: "detalles",
  });

  const watchTipoMovimientoId = watch("tipo_movimiento_id");
  const watchFuncionarioDestinoId = watch("funcionario_destino_id");

  useEffect(() => {
    if (watchFuncionarioDestinoId) {
      const funcMatch = funcionarios.find(
        (f) => f.id.toString() === watchFuncionarioDestinoId,
      );
      if (funcMatch) {
        const docNum = funcMatch.numeroDocumento || funcMatch.numero_documento || "";
        setValue("numero_documento", docNum, { shouldValidate: false });
      }
    }
  }, [watchFuncionarioDestinoId, funcionarios, setValue]);

  const isInventarioUI = useMemo(() => {
    const currTipo = tiposMovimiento?.find(
      (t) => t.id.toString() === watchTipoMovimientoId,
    );
    return (
      currTipo &&
      (currTipo.nombre?.toUpperCase() === "TOMA DE INVENTARIO" ||
        currTipo.codigo?.toUpperCase() === "INV")
    );
  }, [tiposMovimiento, watchTipoMovimientoId]);

  const isFirstRender = useRef(true);
  const prevFuncionarioId = useRef(watchFuncionarioDestinoId);
  const prevIsInventario = useRef(isInventarioUI);

  useEffect(() => {
    if (movimientoToEdit) return; // Solo autocompletar en modo de creación

    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevFuncionarioId.current = watchFuncionarioDestinoId;
      prevIsInventario.current = isInventarioUI;
      return;
    }

    const funcChanged = watchFuncionarioDestinoId !== prevFuncionarioId.current;
    const tipoChanged = isInventarioUI !== prevIsInventario.current;

    if (funcChanged || tipoChanged) {
      if (isInventarioUI && watchFuncionarioDestinoId) {
        // Cargar activos asignados vigentes al funcionario seleccionado
        const assignedAssets = activos.filter(
          (a) =>
            a.funcionario_custodio_id?.toString() ===
              watchFuncionarioDestinoId && a.estado === "ACTIVO",
        );

        const newDetalles = assignedAssets.map((a) => ({
          ...DETALLE_INITIAL,
          activo_id: a.id.toString(),
          estado_activo_anterior: a.estado || "",
        }));

        replace(newDetalles);
      } else if (tipoChanged) {
        // Si se cambia de inventario a otra cosa, limpiar detalles
        replace([]);
      }

      prevFuncionarioId.current = watchFuncionarioDestinoId;
      prevIsInventario.current = isInventarioUI;
    }
  }, [
    watchFuncionarioDestinoId,
    isInventarioUI,
    activos,
    replace,
    movimientoToEdit,
  ]);

  const fileInputRef = useRef(null);
  const [activeImageIndex, setActiveImageIndex] = useState(null);

  // Estados para el Modal de Galería
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryDetalleIndex, setGalleryDetalleIndex] = useState(null);
  const [persistedImages, setPersistedImages] = useState([]);
  const [isLoadingImages, setIsLoadingImages] = useState(false);

  const handleImageClick = (index) => {
    setActiveImageIndex(index);
    fileInputRef.current?.click();
  };

  const openGallery = async (index) => {
    setGalleryDetalleIndex(index);
    setIsGalleryOpen(true);
    setPersistedImages([]);

    const row = watch(`detalles.${index}`);
    if (row?.id) {
      setIsLoadingImages(true);
      try {
        const dbImages = await getImagenesByDetalleId(row.id);
        setPersistedImages(dbImages);
      } catch (error) {
        console.error("Error cargando imágenes:", error);
      } finally {
        setIsLoadingImages(false);
      }
    }
  };

  const closeGallery = () => {
    setIsGalleryOpen(false);
    setGalleryDetalleIndex(null);
    setPersistedImages([]);
  };

  const removeLocalImage = (fileIndex) => {
    if (galleryDetalleIndex === null) return;
    const currentFiles = watch(
      `detalles.${galleryDetalleIndex}.imagenes_adjuntas`,
    );
    if (currentFiles && currentFiles.length > 0) {
      const newFiles = Array.from(currentFiles).filter(
        (_, i) => i !== fileIndex,
      );
      setValue(`detalles.${galleryDetalleIndex}.imagenes_adjuntas`, newFiles, {
        shouldDirty: true,
      });
    }
  };

  const removePersistedImage = async (imageId, url) => {
    if (
      !window.confirm("¿Estás seguro de eliminar permanentemente esta imagen?")
    )
      return;

    try {
      await deleteImagen(imageId, url);
      setPersistedImages((prev) => prev.filter((img) => img.id !== imageId));
    } catch (error) {
      console.error("Error eliminando imagen de BD/Storage:", error);
      alert("Hubo un error al intentar eliminar la imagen.");
    }
  };

  const handleFileChange = (e) => {
    if (activeImageIndex === null) return;
    const files = Array.from(e.target.files);
    if (files.length > 5) {
      alert("Solo se pueden subir hasta 5 imágenes por activo.");
      e.target.value = null;
      return;
    }
    setValue(`detalles.${activeImageIndex}.imagenes_adjuntas`, files);
    setActiveImageIndex(null);
    e.target.value = null;
  };

  const prevFuncionarioRef = useRef(
    movimientoToEdit?.funcionario_destino_id?.toString() || "",
  );
  const prevTipoRef = useRef(
    movimientoToEdit?.tipo_movimiento_id?.toString() || "",
  );

  useEffect(() => {
    const hasChanged =
      prevFuncionarioRef.current !== watchFuncionarioDestinoId ||
      prevTipoRef.current !== watchTipoMovimientoId;

    const prevTipoSelected = tiposMovimiento?.find(
      (t) => t.id.toString() === prevTipoRef.current,
    );
    const currTipoSelected = tiposMovimiento?.find(
      (t) => t.id.toString() === watchTipoMovimientoId,
    );

    const wasInventario =
      prevTipoSelected &&
      (prevTipoSelected.nombre?.toUpperCase() === "TOMA DE INVENTARIO" ||
        prevTipoSelected.codigo?.toUpperCase() === "INV");
    const isInventario =
      currTipoSelected &&
      (currTipoSelected.nombre?.toUpperCase() === "TOMA DE INVENTARIO" ||
        currTipoSelected.codigo?.toUpperCase() === "INV");

    prevFuncionarioRef.current = watchFuncionarioDestinoId || "";
    prevTipoRef.current = watchTipoMovimientoId || "";

    if (!hasChanged) return;

    if (isInventario) {
      if (watchFuncionarioDestinoId) {
        const activosAsignados = activos.filter(
          (a) =>
            a.funcionario_custodio_id?.toString() ===
              watchFuncionarioDestinoId && (a.estado || "ACTIVO") === "ACTIVO",
        );

        const newDetalles = activosAsignados.map((a) => ({
          activo_id: a.id.toString(),
          estado_activo_anterior: "",
          estado_activo_nuevo: "",
          condicion_anterior: "",
          condicion_nueva: "",
          observaciones: "Auto-cargado por Toma de Inventario",
        }));

        replace(newDetalles);
      } else {
        replace([]);
      }
    } else if (wasInventario) {
      replace([]);
    }
  }, [
    watchTipoMovimientoId,
    watchFuncionarioDestinoId,
    activos,
    tiposMovimiento,
    replace,
  ]);

  // Resetear el formulario cuando cambian los valores iniciales (ej. al editar otro registro)
  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const sortedTiposMovimiento = useMemo(() => {
    if (!tiposMovimiento) return [];
    return [...tiposMovimiento].sort((a, b) =>
      a.nombre.localeCompare(b.nombre),
    );
  }, [tiposMovimiento]);

  const funcionarioOptions = useMemo(
    () =>
      createOptionsList(funcionarios, "id", (f) =>
        `${f.nombres} ${f.apellido_paterno} ${f.apellido_materno || ""}`.trim(),
      ),
    [funcionarios],
  );
  const ubicacionOptions = useMemo(
    () => createOptionsList(ubicaciones, "id", (u) => u.nombre),
    [ubicaciones],
  );

  const activosMap = useMemo(
    () =>
      createLookupMap(
        activos,
        "id",
        (a) => `${a.codigo_patrimonial} - ${a.denominacion}`,
      ),
    [activos],
  );

  const estadosActivoMap = useMemo(
    () => createLookupMap(estadosActivo, "id"),
    [estadosActivo],
  );

  const handleDetalleChange = (field, value) => {
    setDetalleTemporal((prev) => ({ ...prev, [field]: value }));
  };

  const handleSearchActivo = () => {
    if (!numeroPatrimonial.trim()) return;
    const codigoCompleto = "OJ-02-" + numeroPatrimonial.trim();
    const activo = activos.find((a) => a.codigo_patrimonial === codigoCompleto);
    if (activo) {
      handleDetalleChange("activo_id", activo.id.toString());
    }
  };

  const addDetalleToList = () => {
    if (!detalleTemporal.activo_id) {
      if (toast)
        toast({
          title: "Error",
          description: "Debe seleccionar un activo",
          variant: "destructive",
        });
      return;
    }

    const isEditing = editingDetalleIndex !== null;
    const existingIndex = fields.findIndex(
      (d) => d.activo_id === detalleTemporal.activo_id,
    );

    if (!isEditing && existingIndex !== -1) {
      if (toast)
        toast({
          title: "Error",
          description: "El activo ya fue agregado",
          variant: "destructive",
        });
      return;
    }

    const payload = { ...detalleTemporal };

    if (isEditing) {
      update(editingDetalleIndex, payload);
      setEditingDetalleIndex(null);
    } else {
      append(payload);
    }
    setDetalleTemporal({ ...DETALLE_INITIAL });
    setNumeroPatrimonial("");
  };

  const handleEditDetalle = (index) => {
    const d = fields[index];
    const activo = activos.find((a) => a.id.toString() === d.activo_id);
    setDetalleTemporal({
      activo_id: d.activo_id,
      estado_activo_anterior: d.estado_activo_anterior || "",
      estado_activo_nuevo: d.estado_activo_nuevo || "",
      condicion_nueva: d.condicion_nueva || "",
      observaciones: d.observaciones || "",
    });
    setNumeroPatrimonial(
      activo ? activo.codigo_patrimonial.replace("OJ-02-", "") : "",
    );
    setEditingDetalleIndex(index);
  };

  const cancelEditDetalle = () => {
    setDetalleTemporal({ ...DETALLE_INITIAL });
    setNumeroPatrimonial("");
    setEditingDetalleIndex(null);
  };

  const onFormSubmit = async (data) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const cabeceraData = {
        entidad_id: 1, // Fijo en el sistema
        tipo_movimiento_id: parseInt(data.tipo_movimiento_id),
        fecha_movimiento:
          data.fecha_movimiento || new Date().toISOString().split("T")[0],
        fecha_aprobacion: data.fecha_aprobacion || null,
        numero_acta: data.numero_acta || null,
        numero_resolucion: data.numero_resolucion || null,
        funcionario_origen_id: data.funcionario_origen_id
          ? parseInt(data.funcionario_origen_id)
          : null,
        ubicacion_origen_id: data.ubicacion_origen_id
          ? parseInt(data.ubicacion_origen_id)
          : null,
        funcionario_destino_id: data.funcionario_destino_id
          ? parseInt(data.funcionario_destino_id)
          : null,
        ubicacion_destino_id: data.ubicacion_destino_id
          ? parseInt(data.ubicacion_destino_id)
          : null,
        estado_movimiento: data.estado_movimiento || "BORRADOR",
        aprobado_por_id: data.aprobado_por_id
          ? parseInt(data.aprobado_por_id)
          : null,
        motivo: data.motivo || null,
        observaciones: data.observaciones || null,
        creado_por: data.aprobado_por_id
          ? parseInt(data.aprobado_por_id)
          : data.funcionario_destino_id
            ? parseInt(data.funcionario_destino_id)
            : data.funcionario_origen_id
              ? parseInt(data.funcionario_origen_id)
              : 1, // Fallback integer to satisfy not-null constraint
      };

      const detallesData = data.detalles.map((d, i) => ({
        activo_id: parseInt(d.activo_id),
        estado_activo_anterior: d.estado_activo_anterior
          ? parseInt(d.estado_activo_anterior)
          : null,
        estado_activo_nuevo: d.estado_activo_nuevo
          ? parseInt(d.estado_activo_nuevo)
          : null,
        condicion_anterior: d.condicion_anterior || null,
        condicion_nueva: d.condicion_nueva || null,
        observaciones: d.observaciones || null,
        numero_linea: i + 1,
      }));

      const tipoMovimiento = tiposMovimiento?.find(
        t => t.id.toString() === data.tipo_movimiento_id
      );

      if (tipoMovimiento && /ASIGNACIÓN.*FUNCIONARIO/i.test(tipoMovimiento.nombre)) {
        const funcionarioId = cabeceraData.funcionario_destino_id;

          if (!funcionarioId) {
            if (toast)
              toast({
                title: "Error de validación",
                description: "Debe seleccionar un funcionario destino para la asignación",
                variant: "destructive",
                duration: 8000,
              });
            setIsSubmitting(false);
            return;
          }

          for (const detalle of detallesData) {
            const { data: activoData } = await supabase
              .from("activos_fijos")
              .select("estado_activo_id, codigo_patrimonial, denominacion")
              .eq("id", detalle.activo_id)
              .single();

            if (activoData && activoData.estado_activo_id === 5) {
              const activoName = `${activoData.codigo_patrimonial} - ${activoData.denominacion}`;

              let funcionarioAsignado = "un funcionario";
              const { data: asigActual } = await supabase
                .from("asignaciones")
                .select("funcionario_id")
                .eq("activo_id", detalle.activo_id)
                .eq("activa", true)
                .maybeSingle();

              if (asigActual) {
                const { data: funcData } = await supabase
                  .from("funcionarios")
                  .select("nombre_completo")
                  .eq("id", asigActual.funcionario_id)
                  .single();
                if (funcData) funcionarioAsignado = funcData.nombre_completo;
              }

              if (toast)
                toast({
                  title: "Error de validación",
                  description: `Activo "${activoName}" actualmente asignado a "${funcionarioAsignado}"`,
                  variant: "destructive",
                  duration: 8000,
                });
              setIsSubmitting(false);
              return;
            }

            if (activoData && activoData.estado_activo_id !== 4 && activoData.estado_activo_id !== 6) {
              const activoName = `${activoData.codigo_patrimonial} - ${activoData.denominacion}`;
              if (toast)
                toast({
                  title: "Error de validación",
                  description: `El activo "${activoName}" debe estar en estado NO ASIGNADO o DEVUELTO`,
                  variant: "destructive",
                  duration: 8000,
                });
              setIsSubmitting(false);
              return;
            }

            const { data: asignacion } = await supabase
              .from("asignaciones")
              .select("id")
              .eq("activo_id", detalle.activo_id)
              .eq("funcionario_id", funcionarioId)
              .eq("activa", true)
              .maybeSingle();

            if (asignacion) {
              const activoName = activoData
                ? `${activoData.codigo_patrimonial} - ${activoData.denominacion}`
                : `ID: ${detalle.activo_id}`;
              if (toast)
                toast({
                  title: "Error de validación",
                  description: `El activo "${activoName}" ya se encuentra asignado al funcionario`,
                  variant: "destructive",
                  duration: 8000,
                });
              setIsSubmitting(false);
              return;
            }
          }
      }

      if (tipoMovimiento && /DEVOLUCIÓN.*ACTIVO/i.test(tipoMovimiento.nombre)) {
        for (const detalle of detallesData) {
          const { data: activoData } = await supabase
            .from("activos_fijos")
            .select("estado_activo_id, codigo_patrimonial, denominacion")
            .eq("id", detalle.activo_id)
            .single();

          if (activoData && activoData.estado_activo_id !== 5) {
            const activoName = `${activoData.codigo_patrimonial} - ${activoData.denominacion}`;
            if (toast)
              toast({
                title: "Error de validación",
                description: `Activo "${activoName}" no se encuentra asignado`,
                variant: "destructive",
                duration: 8000,
              });
            setIsSubmitting(false);
            return;
          }
        }
      }

      const success = await onSubmit({
        cabecera: cabeceraData,
        detalles: detallesData,
      });
      if (success !== false) {
        onCancel();
      }
    } catch (error) {
      console.error(error);
      if (toast)
        toast({
          title: "Error",
          description: "Error inesperado al guardar",
          variant: "destructive",
        });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderComboboxController = (
    name,
    label,
    options,
    placeholder,
    searchPlaceholder,
    isRequired = false,
  ) => (
    <div className="space-y-2">
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <ComboboxField
            label={
              isRequired ? (
                <>
                  {label} <span className="text-red-500">*</span>
                </>
              ) : (
                label
              )
            }
            value={field.value}
            onValueChange={field.onChange}
            options={options}
            placeholder={placeholder}
            searchPlaceholder={searchPlaceholder}
            loading={loadingFK}
            disabled={loadingFK}
          />
        )}
      />
      {errors[name] && (
        <p className="text-sm text-red-500">{errors[name].message}</p>
      )}
    </div>
  );

  return (
    <>
      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6 py-4">
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" />
            Datos de la Cabecera
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-white">
            <div className="space-y-2">
              <Label htmlFor="numero_documento">Número de Documento</Label>
              <Input
                id="numero_documento"
                placeholder="Número de documento"
                {...register("numero_documento")}
              />
            </div>
            {renderComboboxController(
              "funcionario_destino_id",
              "Funcionario Destino",
              funcionarioOptions,
              "Seleccionar funcionario",
              "Buscar funcionario...",
              true,
            )}
            {/* {renderComboboxController(
              "ubicacion_destino_id",
              "Ubicación Destino",
              ubicacionOptions,
              "Seleccionar (opcional)",
              "Buscar ubicación...",
            )} */}
            <div className="space-y-2">
              <Label htmlFor="tipo_movimiento_id">
                Tipo de Movimiento <span className="text-red-500">*</span>
              </Label>
              <Controller
                name="tipo_movimiento_id"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={loadingFK}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {sortedTiposMovimiento.map((t) => (
                        <SelectItem key={t.id} value={t.id.toString()}>
                          {t.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.tipo_movimiento_id && (
                <p className="text-sm text-red-500">
                  {errors.tipo_movimiento_id.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fecha_movimiento">
                Fecha Movimiento <span className="text-red-500">*</span>
              </Label>
              <Input
                id="fecha_movimiento"
                type="date"
                {...register("fecha_movimiento")}
              />
              {errors.fecha_movimiento && (
                <p className="text-sm text-red-500">
                  {errors.fecha_movimiento.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="numero_acta">N° Acta</Label>
              <Input
                id="numero_acta"
                placeholder="Número de acta"
                {...register("numero_acta")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="numero_resolucion">N° Resolución</Label>
              <Input
                id="numero_resolucion"
                placeholder="Número de resolución"
                {...register("numero_resolucion")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estado_movimiento">Estado</Label>
              <Controller
                name="estado_movimiento"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ESTADO_MOVIMIENTO_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fecha_aprobacion">Fecha Aprobación</Label>
              <Input
                id="fecha_aprobacion"
                type="date"
                {...register("fecha_aprobacion")}
              />
            </div>

            <div className="space-y-2 md:col-span-3">
              <Label htmlFor="motivo">Motivo</Label>
              <Input
                id="motivo"
                placeholder="Motivo del movimiento"
                {...register("motivo")}
              />
            </div>

            <div className="space-y-2 md:col-span-3">
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea
                id="observaciones"
                placeholder="Observaciones adicionales..."
                {...register("observaciones")}
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" />
            Detalle del Movimiento
          </h3>

          <div className="p-4 border rounded-lg bg-white mb-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-2 md:col-span-4">
                <Label htmlFor="numero_patrimonial">Código Patrimonial</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium whitespace-nowrap text-muted-foreground">
                    OJ-02-
                  </span>
                  <Input
                    id="numero_patrimonial"
                    className="max-w-[100px]"
                    placeholder="00000"
                    value={numeroPatrimonial}
                    onChange={(e) => setNumeroPatrimonial(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSearchActivo();
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleSearchActivo}
                    title="Buscar activo"
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2 md:col-span-4">
                <Label>
                  Activo <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={
                    detalleTemporal.activo_id
                      ? activos.find(
                          (a) => a.id.toString() === detalleTemporal.activo_id,
                        )?.denominacion || ""
                      : ""
                  }
                  placeholder="Busque por código patrimonial"
                  readOnly
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estado_activo_anterior">Estado Anterior</Label>
                <Select
                  value={detalleTemporal.estado_activo_anterior}
                  onValueChange={(v) =>
                    handleDetalleChange("estado_activo_anterior", v)
                  }
                  disabled={loadingFK}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    {estadosActivo.map((e) => (
                      <SelectItem key={e.id} value={e.id.toString()}>
                        {e.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="estado_activo_nuevo">Estado Nuevo</Label>
                <Select
                  value={detalleTemporal.estado_activo_nuevo}
                  onValueChange={(v) =>
                    handleDetalleChange("estado_activo_nuevo", v)
                  }
                  disabled={loadingFK}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    {estadosActivo.map((e) => (
                      <SelectItem key={e.id} value={e.id.toString()}>
                        {e.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="condicion_nueva">Condición</Label>
                <Input
                  id="condicion_nueva"
                  placeholder="Condición del activo"
                  value={detalleTemporal.condicion_nueva}
                  onChange={(e) =>
                    handleDetalleChange("condicion_nueva", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-4">
                <Label htmlFor="detalle_observaciones">
                  Observaciones del Detalle
                </Label>
                <Input
                  id="detalle_observaciones"
                  placeholder="Observaciones de este detalle..."
                  value={detalleTemporal.observaciones}
                  onChange={(e) =>
                    handleDetalleChange("observaciones", e.target.value)
                  }
                />
              </div>
              <div className="md:col-span-4 flex justify-end gap-2">
                {editingDetalleIndex !== null && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={cancelEditDetalle}
                    className="gap-2"
                  >
                    <X className="h-4 w-4" />
                    Cancelar
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={addDetalleToList}
                  className="gap-2"
                >
                  {editingDetalleIndex !== null ? (
                    <Edit className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {editingDetalleIndex !== null
                    ? "Guardar Edición"
                    : "Agregar Activo"}
                </Button>
              </div>
            </div>
          </div>

          {errors.detalles && (
            <p className="text-sm text-red-500 mb-2">
              {errors.detalles.message}
            </p>
          )}

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Activo</TableHead>
                  <TableHead>Estado Anterior</TableHead>
                  <TableHead>Estado Nuevo</TableHead>
                  <TableHead>Condición</TableHead>
                  <TableHead>Observaciones</TableHead>
                  <TableHead className="w-16 text-center">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.length > 0 ? (
                  fields.map((fieldItem, index) => (
                    <TableRow key={fieldItem.id}>
                      <TableCell className="text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-medium whitespace-normal break-words max-w-[200px]">
                        {activosMap[fieldItem.activo_id] ||
                          `ID: ${fieldItem.activo_id}`}
                      </TableCell>
                      <TableCell>
                        {fieldItem.estado_activo_anterior
                          ? estadosActivoMap[fieldItem.estado_activo_anterior]
                              ?.nombre ||
                            `ID: ${fieldItem.estado_activo_anterior}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {fieldItem.estado_activo_nuevo
                          ? estadosActivoMap[fieldItem.estado_activo_nuevo]
                              ?.nombre || `ID: ${fieldItem.estado_activo_nuevo}`
                          : "—"}
                      </TableCell>
                      <TableCell>{fieldItem.condicion_nueva || "—"}</TableCell>
                      <TableCell className="whitespace-normal break-words max-w-[150px]">
                        {fieldItem.observaciones || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditDetalle(index)}
                            className="text-blue-500 hover:text-blue-700"
                            title="Editar detalle"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {!movimientoToEdit && isInventarioUI && (
                            <div className="relative group flex items-center justify-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleImageClick(index)}
                                className={`hover:text-green-700 ${fieldItem.imagenes_adjuntas?.length > 0 ? "text-green-600" : "text-gray-500"}`}
                                title="Subir imágenes (Máx. 5)"
                              >
                                <Camera className="h-4 w-4" />
                              </Button>
                              {fieldItem.imagenes_adjuntas?.length > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] text-white">
                                  {fieldItem.imagenes_adjuntas.length}
                                </span>
                              )}
                            </div>
                          )}
                          {/* Botón de Galería / Ver Imágenes */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => openGallery(index)}
                            className="text-gray-500 hover:text-purple-700"
                            title="Ver imágenes"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(index)}
                            className="text-red-500 hover:text-red-700"
                            title="Eliminar detalle"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No hay detalles agregados. Seleccione un activo y presione
                      "Agregar Activo".
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <input
              type="file"
              multiple
              accept="image/*"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>

        {errors.root && (
          <div className="text-sm text-white text-center p-3 bg-red-600 rounded">
            {errors.root.message}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || fields.length === 0}>
            {isSubmitting
              ? "Guardando..."
              : movimientoToEdit
                ? `Actualizar Movimiento (${fields.length} detalle${fields.length !== 1 ? "s" : ""})`
                : `Guardar Movimiento (${fields.length} detalle${fields.length !== 1 ? "s" : ""})`}
          </Button>
        </DialogFooter>
      </form>

      <Dialog open={isGalleryOpen} onOpenChange={closeGallery}>
        <DialogContent className="max-w-3xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Galería de Imágenes del Activo</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 max-h-[60vh] overflow-y-auto">
            {isLoadingImages && (
              <p className="col-span-full text-center">
                Cargando imágenes de la BD...
              </p>
            )}

            {/* Imágenes Persistidas */}
            {!isLoadingImages &&
              persistedImages.map((img) => (
                <div
                  key={img.id}
                  className="relative group rounded-md overflow-hidden border"
                >
                  <img
                    src={img.url}
                    alt="Activo Guardado"
                    className="w-full h-40 object-cover"
                  />
                  <div className="absolute top-2 right-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => removePersistedImage(img.id, img.url)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="absolute bottom-0 w-full bg-black/50 text-white text-[10px] text-center p-1">
                    Guardada
                  </div>
                </div>
              ))}

            {/* Imágenes Locales (por subir) */}
            {galleryDetalleIndex !== null &&
              watch(`detalles.${galleryDetalleIndex}.imagenes_adjuntas`) &&
              Array.from(
                watch(`detalles.${galleryDetalleIndex}.imagenes_adjuntas`),
              ).map((file, idx) => (
                <LocalImagePreview
                  key={`local-${idx}`}
                  file={file}
                  onRemove={() => removeLocalImage(idx)}
                />
              ))}

            {!isLoadingImages &&
              persistedImages.length === 0 &&
              (!watch(`detalles.${galleryDetalleIndex}.imagenes_adjuntas`) ||
                watch(`detalles.${galleryDetalleIndex}.imagenes_adjuntas`)
                  .length === 0) && (
                <p className="col-span-full text-center text-muted-foreground py-8">
                  No hay imágenes para este activo.
                </p>
              )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MovimientosForm;
