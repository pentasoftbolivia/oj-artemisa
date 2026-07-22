import { lazy } from "react";

const lazyWithRetry = (componentImport) =>
  lazy(async () => {
    try {
      return await componentImport();
    } catch (error) {
      window.location.reload();
      throw error;
    }
  });

export default lazyWithRetry;
