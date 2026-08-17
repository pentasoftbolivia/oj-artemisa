import { createCrudSlice } from "@/store/generic/createCrudSlice";
import {
  fetchTipoRubros,
  addTipoRubro,
  updateTipoRubro,
  deleteTipoRubro,
} from "./tiporubroThunks";

const { reducer, selectors } = createCrudSlice({
  name: "tiporubro",
  idColumn: "tiporubroact",
  thunks: {
    fetchAll: fetchTipoRubros,
    add: addTipoRubro,
    update: updateTipoRubro,
    remove: deleteTipoRubro,
  },
});

export const selectTipoRubros = selectors.selectData;
export const selectTipoRubrosLoading = selectors.selectLoading;
export const selectTipoRubrosError = selectors.selectError;

export default reducer;
