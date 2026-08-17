import { createCrudThunks } from "@/store/generic/createCrudThunks";

const crud = createCrudThunks({
  prefix: "ciudad",
  table: "act_ciudad",
  idColumn: "codigociudad",
  updatedKey: "updatedCiudad",
});

export const fetchCiudades = crud.fetchAll;
export const addCiudad = crud.add;
export const updateCiudad = crud.update;
export const deleteCiudad = crud.remove;
