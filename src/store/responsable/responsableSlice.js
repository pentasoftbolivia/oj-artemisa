import { createSelector } from "@reduxjs/toolkit";
import { createCrudSlice } from "@/store/generic/createCrudSlice";
import {
  fetchResponsable,
  addResponsable,
  updateResponsable,
  deleteResponsable,
} from "./responsableThunks";

const { reducer, selectors } = createCrudSlice({
  name: "responsable",
  idColumn: "cirun",
  thunks: {
    fetchAll: fetchResponsable,
    add: addResponsable,
    update: updateResponsable,
    remove: deleteResponsable,
  },
});

export const selectSortedResponsable = createSelector(
  selectors.selectData,
  (responsables) => {
    if (!Array.isArray(responsables)) return [];
    return [...responsables].sort((a, b) => {
      const pA = (a.paterno || "").trim().toLowerCase();
      const pB = (b.paterno || "").trim().toLowerCase();
      if (pA !== pB) return pA.localeCompare(pB);

      const mA = (a.materno || "").trim().toLowerCase();
      const mB = (b.materno || "").trim().toLowerCase();
      if (mA !== mB) return mA.localeCompare(mB);

      const n1A = (a.nombre1 || "").trim().toLowerCase();
      const n1B = (b.nombre1 || "").trim().toLowerCase();
      if (n1A !== n1B) return n1A.localeCompare(n1B);

      const n2A = (a.nombre2 || "").trim().toLowerCase();
      const n2B = (b.nombre2 || "").trim().toLowerCase();
      return n2A.localeCompare(n2B);
    });
  }
);

export const selectResponsableLoading = selectors.selectLoading;

export const selectResponsableError = selectors.selectError;

export const selectResponsable = createSelector(
  selectors.selectData,
  (responsables) => (Array.isArray(responsables) ? [...responsables] : [])
);

export default reducer;
