import { useState, useCallback } from "react";

export const useInventarioState = (loadActivos) => {
  // Filtros
  const [filtroCodigoActivo, setFiltroCodigoActivo] = useState("");
  const [filtroInventariador, setFiltroInventariador] = useState("");
  const [filtroCarnet, setFiltroCarnet] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("all");
  const [filtroCiudad, setFiltroCiudad] = useState("");
  const [filtroInmueble, setFiltroInmueble] = useState("");
  const [filtroNivel, setFiltroNivel] = useState("");
  const [filtroAmbiente, setFiltroAmbiente] = useState("");

  // Búsqueda general
  const [showSearch, setShowSearch] = useState(false);
  const [searchCarnet, setSearchCarnet] = useState("");
  const [searchNombre, setSearchNombre] = useState("");

  // Modales
  const [editActivo, setEditActivo] = useState(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedActivoImages, setSelectedActivoImages] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);
  const [isLoadingImages, setIsLoadingImages] = useState(false);

  const getUbicacionFilters = useCallback(() => ({
    ciudad: filtroCiudad,
    inmueble: filtroInmueble,
    nivel: filtroNivel,
    ambiente: filtroAmbiente,
  }), [filtroCiudad, filtroInmueble, filtroNivel, filtroAmbiente]);

  const handleFilter = useCallback(() => {
    loadActivos({
      codigoActivo: filtroCodigoActivo,
      inventariador: filtroInventariador,
      carnet: filtroCarnet,
      estado: filtroEstado,
      ...getUbicacionFilters(),
    });
  }, [loadActivos, filtroCodigoActivo, filtroInventariador, filtroCarnet, filtroEstado, getUbicacionFilters]);

  const clearFilters = useCallback(() => {
    setFiltroCodigoActivo("");
    setFiltroInventariador("");
    setFiltroCarnet("");
    setFiltroEstado("all");
    setFiltroCiudad("");
    setFiltroInmueble("");
    setFiltroNivel("");
    setFiltroAmbiente("");
    loadActivos({});
  }, [loadActivos]);

  const handleSearch = useCallback(() => {
    loadActivos({
      carnet: searchCarnet,
      nombre: searchNombre,
      all: true,
      ...getUbicacionFilters(),
    });
  }, [loadActivos, searchCarnet, searchNombre, getUbicacionFilters]);

  const clearSearch = useCallback(() => {
    setSearchCarnet("");
    setSearchNombre("");
    loadActivos({});
  }, [loadActivos]);

  return {
    filtros: {
      filtroCodigoActivo, setFiltroCodigoActivo,
      filtroInventariador, setFiltroInventariador,
      filtroCarnet, setFiltroCarnet,
      filtroEstado, setFiltroEstado,
      filtroCiudad, setFiltroCiudad,
      filtroInmueble, setFiltroInmueble,
      filtroNivel, setFiltroNivel,
      filtroAmbiente, setFiltroAmbiente,
      getUbicacionFilters,
      handleFilter,
      clearFilters,
    },
    busqueda: {
      showSearch, setShowSearch,
      searchCarnet, setSearchCarnet,
      searchNombre, setSearchNombre,
      handleSearch,
      clearSearch,
    },
    modales: {
      editActivo, setEditActivo,
      isEditOpen, setIsEditOpen,
      editForm, setEditForm,
      isSaving, setIsSaving,
      isImageModalOpen, setIsImageModalOpen,
      selectedActivoImages, setSelectedActivoImages,
      imageFiles, setImageFiles,
      isLoadingImages, setIsLoadingImages,
    }
  };
};
