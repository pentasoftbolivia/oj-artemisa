import JsBarcode from "jsbarcode";
import { useToast } from "@/hooks/use-toast";
import { getRubroFields } from "../constants/inventarioConstants";
import {
  updateActivoFields,
  registerAndTransferActivo,
  updateEstadoInventario,
  fetchActivoImages,
} from "../services/inventarioService";

export const useInventarioActions = ({
  currentUser,
  rubroFromTipo,
  tipoRubroDescMap,
  loadActivos,
  getUbicacionFilters,
  filtroCodigoActivo,
  filtroInventariador,
  filtroCarnet,
  filtroEstado,
  searchCarnet,
  searchNombre,
  showSearch,
  setActivos,
  adjustStatsLocal,
  setEditActivo,
  setIsEditOpen,
  setEditForm,
  setIsSaving,
  editActivo,
  editForm,
  setSelectedActivoImages,
  setIsLoadingImages,
  setIsImageModalOpen,
  setImageFiles,
}) => {
  const { toast } = useToast();

  const getConservacion = (a) => {
    const val =
      a.estadoConservacion ??
      a.estadoconservacion ??
      a.estado_conservacion ??
      "";
    return String(val).trim().toUpperCase();
  };

  const getRubroFieldValues = (activo, rubroDesc) => {
    const fields = getRubroFields(rubroDesc);
    const values = {};
    fields.forEach((f) => {
      values[f.key] = activo[f.key] != null ? String(activo[f.key]) : "";
    });
    return values;
  };

  const handleEdit = (activo) => {
    const rubroDesc = rubroFromTipo[activo.tipoRubroAct] || "";
    const tipoDesc = tipoRubroDescMap[activo.tipoRubroAct] || "";
    const consVal = getConservacion(activo);
    setEditActivo(activo);
    setEditForm({
      codigoActivo:
        activo.codigoActivo != null ? String(activo.codigoActivo) : "",
      rubro: rubroDesc,
      tipoRubro: tipoDesc,
      descripcionActivo: (activo.descripcionActivo || "").trim(),
      observaciones: (activo.observaciones || "").trim(),
      codigoAmbiente: String(activo.codigoAmbiente ?? "").trim(),
      estadoConservacion: consVal,
      marcamaterial:
        activo.marcaMaterial != null
          ? String(activo.marcaMaterial)
          : activo.marcamaterial != null
            ? String(activo.marcamaterial)
            : "",
      modelo: activo.modelo != null ? String(activo.modelo) : "",
      serie: activo.serie != null ? String(activo.serie) : "",
      ...getRubroFieldValues(activo, rubroDesc),
    });
    setIsEditOpen(true);
  };

  const handleEditChange = (e) => {
    const { id, value } = e.target;
    setEditForm((p) => ({ ...p, [id]: value }));
  };

  const handleEditSelectChange = (field, value) => {
    setEditForm((p) => ({ ...p, [field]: value }));
  };

  const handleEditSave = async () => {
    if (!editActivo) return;
    setIsSaving(true);
    try {
      const rubroDesc = rubroFromTipo[editActivo.tipoRubroAct] || "";
      const fieldsToUpdate = {};
      fieldsToUpdate.descripcionactivo = editForm.descripcionActivo;
      fieldsToUpdate.observaciones = editForm.observaciones || null;
      const ambValue = editForm.codigoAmbiente;
      if (ambValue) fieldsToUpdate.codigoambiente = ambValue;
      const rubroFields = getRubroFields(rubroDesc);
      if (editForm.estadoConservacion) {
        fieldsToUpdate.estadoconservacion = editForm.estadoConservacion;
      }
      fieldsToUpdate.marcamaterial = editForm.marcamaterial || null;
      fieldsToUpdate.modelo = editForm.modelo || null;
      fieldsToUpdate.serie = editForm.serie || null;
      rubroFields.forEach((f) => {
        const val = editForm[f.key];
        fieldsToUpdate[f.key] = val || null;
      });

      if (showSearch) {
        fieldsToUpdate.estado = 1;
      }

      await updateActivoFields(editActivo.codigoActivoInterno, fieldsToUpdate);

      toast({
        title: "Éxito",
        description: "Activo actualizado correctamente.",
      });
      setIsEditOpen(false);
      setEditActivo(null);
      loadActivos({
        codigoActivo: filtroCodigoActivo,
        inventariador: filtroInventariador,
        carnet: filtroCarnet,
        estado: filtroEstado,
        ...getUbicacionFilters(),
      });
    } catch (err) {
      toast({
        title: "Error",
        description: `Error al actualizar: ${err.message || ""}`,
        variant: "destructive",
      });
      console.error("Error al actualizar activo:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegistrar = async () => {
    if (!editActivo) return;
    const confirmed = window.confirm(
      "¿Está seguro de registrar y transferir la información?",
    );
    if (!confirmed) return;
    setIsSaving(true);
    try {
      const rubroDesc = rubroFromTipo[editActivo.tipoRubroAct] || "";
      const rubroFields = getRubroFields(rubroDesc);
      const userEmail = currentUser?.email || "unknown";

      await registerAndTransferActivo(
        editActivo,
        editForm,
        userEmail,
        rubroFields
      );

      toast({
        title: "Éxito",
        description: "Activo registrado y transferido correctamente.",
      });
      setIsEditOpen(false);
      setEditActivo(null);
      loadActivos({
        carnet: searchCarnet,
        nombre: searchNombre,
        all: true,
        ...getUbicacionFilters(),
      });
    } catch (err) {
      toast({
        title: "Error",
        description: `Error al registrar: ${err.message || ""}`,
        variant: "destructive",
      });
      console.error("Error al registrar activo:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAprobado = async (activo) => {
    try {
      const isRevisado = activo.estadoinventario === "REVISADO";
      const updateData = isRevisado
        ? { estadoinventario: "INVENTARIADO", aprobadorinventario: null }
        : {
            estadoinventario: "REVISADO",
            aprobadorinventario: currentUser?.email || "unknown",
          };

      await updateEstadoInventario(activo.codigoActivoInterno, updateData);

      toast({
        title: "Éxito",
        description: isRevisado
          ? "Estado de inventario cambiado a INVENTARIADO."
          : "Estado de inventario cambiado a REVISADO.",
      });
      setActivos((prev) =>
        prev.map((a) =>
          a.codigoActivoInterno === activo.codigoActivoInterno
            ? { ...a, ...updateData }
            : a,
        ),
      );
      adjustStatsLocal(activo, updateData.estadoinventario);
    } catch (err) {
      toast({
        title: "Error",
        description: `Error al actualizar: ${err.message}`,
        variant: "destructive",
      });
    }
  };

  const handleEnviar = async (activo) => {
    try {
      await updateEstadoInventario(activo.codigoActivoInterno, {
        estadoinventario: "ENVIADO",
      });

      toast({ title: "Éxito", description: "Estado cambiado a ENVIADO." });
      setActivos((prev) =>
        prev.map((a) =>
          a.codigoActivoInterno === activo.codigoActivoInterno
            ? { ...a, estadoinventario: "ENVIADO" }
            : a,
        ),
      );
      adjustStatsLocal(activo, "ENVIADO");
    } catch (err) {
      toast({
        title: "Error",
        description: `Error al actualizar: ${err.message}`,
        variant: "destructive",
      });
    }
  };

  const handleOpenImages = async (activo) => {
    setSelectedActivoImages(activo);
    setIsLoadingImages(true);
    setIsImageModalOpen(true);
    try {
      const files = await fetchActivoImages(activo.codigoActivo);
      setImageFiles(files);
    } catch (e) {
      console.error("Error al cargar imágenes:", e);
      setImageFiles([]);
    } finally {
      setIsLoadingImages(false);
    }
  };

  const handleImprimirCodigosBarra = (activo) => {
    const rawCod = String(activo.codigoActivo ?? "").trim();
    if (!rawCod) return;

    const fullCodeStr = `OJ-02-${rawCod}`;

    const svgNode = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(svgNode, fullCodeStr, {
      format: "CODE128",
      width: 2,
      height: 60,
      displayValue: false,
      margin: 0,
    });

    const svgXml = new XMLSerializer().serializeToString(svgNode);
    const svgBase64 = `data:image/svg+xml;base64,${btoa(svgXml)}`;

    const printWin = window.open("", "_blank");
    if (!printWin) return;

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Imprimir Código de Barras - ${fullCodeStr}</title>
        <style>
          @page { size: auto; margin: 5mm; }
          body { font-family: Arial, sans-serif; display: flex; flex-direction: column; items: center; justify-content: center; margin: 0; padding: 20px; }
          .label { border: 1px dashed #ccc; padding: 15px; text-align: center; display: inline-block; }
          .title { font-size: 14px; font-weight: bold; margin-bottom: 5px; }
          .barcode-img { max-width: 250px; height: auto; }
          .code-text { font-size: 16px; font-weight: bold; letter-spacing: 1px; margin-top: 5px; }
        </style>
      </head>
      <body>
        <div class="label">
          <div class="title">ÓRGANO JUDICIAL - LA PAZ</div>
          <img src="${svgBase64}" class="barcode-img" alt="Barcode" />
          <div class="code-text">${fullCodeStr}</div>
        </div>
        <script>
          window.onload = function() { window.print(); window.close(); };
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  };

  return {
    handleEdit,
    handleEditChange,
    handleEditSelectChange,
    handleEditSave,
    handleRegistrar,
    handleToggleAprobado,
    handleEnviar,
    handleOpenImages,
    handleImprimirCodigosBarra,
  };
};
