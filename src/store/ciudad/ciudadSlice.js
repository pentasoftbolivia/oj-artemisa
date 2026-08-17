import { createCrudSlice } from "@/store/generic/createCrudSlice";
import {
  fetchCiudades,
  addCiudad,
  updateCiudad,
  deleteCiudad,
} from "./ciudadThunks";

const { reducer, selectors } = createCrudSlice({
  name: "ciudad",
  idColumn: "codigociudad",
  thunks: {
    fetchAll: fetchCiudades,
    add: addCiudad,
    update: updateCiudad,
    remove: deleteCiudad,
  },
});

export const selectCiudades = selectors.selectData;
export const selectCiudadesLoading = selectors.selectLoading;
export const selectCiudadesError = selectors.selectError;

export default reducer;
