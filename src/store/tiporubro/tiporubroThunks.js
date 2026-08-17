import { createCrudThunks } from "@/store/generic/createCrudThunks";

const crud = createCrudThunks({
  prefix: "tiporubro",
  table: "act_tiporubro",
  idColumn: "tiporubroact",
  updatedKey: "updatedTipoRubro",
});

export const fetchTipoRubros = crud.fetchAll;
export const addTipoRubro = crud.add;
export const updateTipoRubro = crud.update;
export const deleteTipoRubro = crud.remove;
