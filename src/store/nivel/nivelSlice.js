import { createCrudSlice } from "@/store/generic/createCrudSlice";
import {
  fetchNiveles,
  addNivel,
  updateNivel,
  deleteNivel,
} from "./nivelThunks";

const { reducer, selectors } = createCrudSlice({
  name: "nivel",
  idColumn: "codigonivel",
  thunks: {
    fetchAll: fetchNiveles,
    add: addNivel,
    update: updateNivel,
    remove: deleteNivel,
  },
});

export const selectNiveles = selectors.selectData;
export const selectNivelesLoading = selectors.selectLoading;
export const selectNivelesError = selectors.selectError;

export default reducer;
