import { useState, useCallback } from "react";

export function useCrudModal() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleAdd = useCallback(() => {
    setEditingItem(null);
    setIsFormOpen(true);
  }, []);

  const handleEdit = useCallback((item) => {
    setEditingItem(item);
    setIsFormOpen(true);
  }, []);

  const handleCancelForm = useCallback(() => {
    setIsFormOpen(false);
    setEditingItem(null);
  }, []);

  const handleDelete = useCallback((item) => {
    setItemToDelete(item);
    setIsDeleteDialogOpen(true);
  }, []);

  const handleCancelDelete = useCallback(() => {
    setIsDeleteDialogOpen(false);
    setItemToDelete(null);
  }, []);

  return {
    isFormOpen,
    setIsFormOpen,
    editingItem,
    handleAdd,
    handleEdit,
    handleCancelForm,
    
    itemToDelete,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    handleDelete,
    handleCancelDelete,
  };
}
