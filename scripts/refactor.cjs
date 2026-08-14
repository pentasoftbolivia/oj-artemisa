const fs = require('fs');
const path = require('path');

const modules = [
  { name: 'ambiente', id: 'codigoambiente', entity: 'Ambiente', desc: 'ambiente', search: ['ambiente', 'codigoambiente', 'codigonivel'] },
  { name: 'ciudad', id: 'codigociudad', entity: 'Ciudad', desc: 'descripcion', search: ['descripcion', 'codigociudad'] },
  { name: 'inmueble', id: 'codigoinmueble', entity: 'Inmueble', desc: 'descripcion', search: ['descripcion', 'codigoinmueble'] },
  { name: 'nivel', id: 'codigonivel', entity: 'Nivel', desc: 'descripcion', search: ['descripcion', 'codigonivel'] },
  { name: 'rubro', id: 'codigorubroact', entity: 'Rubro', desc: 'descripcionrubroact', search: ['descripcionrubroact', 'codigorubroact'] },
  { name: 'tiporubro', id: 'tiporubroact', entity: 'TipoRubro', desc: 'descripciontiporubroact', search: ['descripciontiporubroact', 'tiporubroact', 'codigorubroact'] }
];

const basePath = path.join(__dirname, '../src');

modules.forEach(mod => {
  const filePath = path.join(basePath, mod.name, 'pages', `${mod.entity}List.jsx`);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${mod.name}, file not found.`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');

  // Add imports if they don't exist
  if (!content.includes('useCrudModal')) {
    content = content.replace('import { useToast } from "@/hooks/use-toast";', 'import { useToast } from "@/hooks/use-toast";\nimport { useCrudModal } from "@/hooks/useCrudModal";\nimport { useCatalogState } from "@/hooks/useCatalogState";');
  }

  // Define regexes to find the start of the component and its return
  const listRegex = new RegExp(`const ${mod.entity}List = \\(\\) => \\{[\\s\\S]*?return \\(`, 'm');
  
  const componentStartMatch = content.match(listRegex);
  if (componentStartMatch) {
    const originalBody = componentStartMatch[0];
    
    // We will build the new body
    let newBody = `const ${mod.entity}List = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();
  const ${mod.name}s = useSelector(select${mod.entity}s${mod.name === 'rubro' || mod.name === 'tiporubro' ? 'Data' : ''});
  const isLoading = useSelector(select${mod.entity}sLoading);
  const error = useSelector(select${mod.entity}sError);

  const {
    isFormOpen,
    setIsFormOpen,
    editingItem: editing${mod.entity},
    handleAdd,
    handleEdit,
    handleCancelForm: handleCancel,
    itemToDelete: ${mod.name}ToDelete,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    handleDelete,
  } = useCrudModal();

  const {
    filters,
    currentPage,
    pageSize,
    setPageSize,
    setCurrentPage,
    handleFilterChange,
    clearFilters,
    filteredData: filtered,
    paginatedData,
    totalPages,
    safeCurrentPage,
  } = useCatalogState({
    data: ${mod.name}s,
    searchFields: ${JSON.stringify(mod.search)},
    sortField: "${mod.desc}"
  });

  useEffect(() => {
    dispatch(fetch${mod.entity}s());
  }, [dispatch]);

  const confirmDelete = useCallback(() => {
    if (${mod.name}ToDelete) {
      dispatch(delete${mod.entity}(${mod.name}ToDelete.${mod.id}));
      setIsDeleteDialogOpen(false);
      toast({ title: "¡Éxito!", description: "Se ha eliminado correctamente." });
    }
  }, [${mod.name}ToDelete, dispatch, toast, setIsDeleteDialogOpen]);

  const handleSubmit = useCallback(async (data) => {
    const action = editing${mod.entity}
      ? update${mod.entity}({ ${mod.id}: editing${mod.entity}.${mod.id}, updated${mod.entity}: data })
      : add${mod.entity}(data);
    try {
      await dispatch(action).unwrap();
      toast({ title: "¡Éxito!", description: \`Se ha \${editing${mod.entity} ? "actualizado" : "guardado"} correctamente.\` });
      handleCancel();
      return true;
    } catch (err) {
      toast({ title: "Error", description: \`Fallo al guardar: \${err.message || "Error desconocido"}\`, variant: "destructive" });
      return false;
    }
  }, [dispatch, editing${mod.entity}, toast, handleCancel]);

  if (isLoading && ${mod.name}s.length === 0) return <LoadingSpinner />;
  if (error) return <div className="bg-red-600 text-white text-center p-4 rounded-lg">Error: {error}</div>;

  return (`

    // Also replace selectCiudadesData if it existed instead of selectCiudades
    if (originalBody.includes(`select${mod.entity}sData`)) {
      newBody = newBody.replace(`select${mod.entity}s`, `select${mod.entity}sData`);
    }

    content = content.replace(listRegex, newBody);
  }

  // Remove duplicate imports
  content = content.replace(/import { useState, useEffect, useCallback, useMemo } from "react";/g, 'import React, { useEffect, useCallback } from "react";');
  
  fs.writeFileSync(filePath, content);
  console.log(`Refactored ${mod.entity}List.jsx`);
});
