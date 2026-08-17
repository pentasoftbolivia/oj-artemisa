import { createCrudThunks } from "@/store/generic/createCrudThunks";

const crud = createCrudThunks({
  prefix: "rubro",
  table: "act_rubro",
  idColumn: "codigorubroact",
  updatedKey: "updatedRubro",
});

export const fetchRubros = crud.fetchAll;
export const addRubro = crud.add;
export const updateRubro = crud.update;
export const deleteRubro = crud.remove;
