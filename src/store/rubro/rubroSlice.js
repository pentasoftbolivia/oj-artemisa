import { createCrudSlice } from "@/store/generic/createCrudSlice";
import {
  fetchRubros,
  addRubro,
  updateRubro,
  deleteRubro,
} from "./rubroThunks";

const { reducer, selectors } = createCrudSlice({
  name: "rubro",
  idColumn: "codigorubroact",
  thunks: {
    fetchAll: fetchRubros,
    add: addRubro,
    update: updateRubro,
    remove: deleteRubro,
  },
});

export const selectRubros = selectors.selectData;
export const selectRubrosLoading = selectors.selectLoading;
export const selectRubrosError = selectors.selectError;

export default reducer;
