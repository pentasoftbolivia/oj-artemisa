import { createCrudThunks } from "@/store/generic/createCrudThunks";

const crud = createCrudThunks({
  prefix: "nivel",
  table: "act_nivel",
  idColumn: "codigonivel",
  updatedKey: "updatedNivel",
});

export const fetchNiveles = crud.fetchAll;
export const addNivel = crud.add;
export const updateNivel = crud.update;
export const deleteNivel = crud.remove;
