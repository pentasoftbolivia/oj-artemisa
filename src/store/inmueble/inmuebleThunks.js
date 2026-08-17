import { createCrudThunks } from "@/store/generic/createCrudThunks";

const crud = createCrudThunks({
  prefix: "inmueble",
  table: "act_inmueble",
  idColumn: "codigoinmueble",
  updatedKey: "updatedInmueble",
});

export const fetchInmuebles = crud.fetchAll;
export const addInmueble = crud.add;
export const updateInmueble = crud.update;
export const deleteInmueble = crud.remove;
