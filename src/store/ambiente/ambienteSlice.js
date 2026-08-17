import { createCrudSlice } from "@/store/generic/createCrudSlice";
import {
  fetchAmbientes,
  addAmbiente,
  updateAmbiente,
  deleteAmbiente,
} from "./ambienteThunks";

const { reducer, selectors } = createCrudSlice({
  name: "ambiente",
  idColumn: "codigoambiente",
  thunks: {
    fetchAll: fetchAmbientes,
    add: addAmbiente,
    update: updateAmbiente,
    remove: deleteAmbiente,
  },
});

export const selectAmbientes = selectors.selectData;
export const selectAmbientesLoading = selectors.selectLoading;
export const selectAmbientesError = selectors.selectError;

export default reducer;
