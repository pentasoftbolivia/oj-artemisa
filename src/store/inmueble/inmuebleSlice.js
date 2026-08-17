import { createCrudSlice } from "@/store/generic/createCrudSlice";
import {
  fetchInmuebles,
  addInmueble,
  updateInmueble,
  deleteInmueble,
} from "./inmuebleThunks";

const { reducer, selectors } = createCrudSlice({
  name: "inmueble",
  idColumn: "codigoinmueble",
  thunks: {
    fetchAll: fetchInmuebles,
    add: addInmueble,
    update: updateInmueble,
    remove: deleteInmueble,
  },
});

export const selectInmuebles = selectors.selectData;
export const selectInmueblesLoading = selectors.selectLoading;
export const selectInmueblesError = selectors.selectError;

export default reducer;
