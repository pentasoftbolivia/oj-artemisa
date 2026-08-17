import { createCrudThunks } from "@/store/generic/createCrudThunks";

const crud = createCrudThunks({
  prefix: "ambiente",
  table: "act_ambiente",
  idColumn: "codigoambiente",
  updatedKey: "updatedAmbiente",
});

export const fetchAmbientes = crud.fetchAll;
export const addAmbiente = crud.add;
export const updateAmbiente = crud.update;
export const deleteAmbiente = crud.remove;
