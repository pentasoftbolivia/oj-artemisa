import React, { useEffect } from "react";
import { useDispatch, useSelector } from 'react-redux';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Package,
  CalendarClock,
  Loader2,
} from 'lucide-react';

import { fetchMaterials } from "@/store/material/materialThunks";
import {
  selectMaterials,
  selectMaterialsLoading,
} from "@/store/material/materialSlice";

const MaterialDashboard = () => {
  const dispatch = useDispatch();
  const materials = useSelector(selectMaterials);
  const isLoading = useSelector(selectMaterialsLoading);

  useEffect(() => {
    dispatch(fetchMaterials());
  }, [dispatch]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tablero de Materiales</h1>
          <p className="text-muted-foreground">
            Resumenes y totales de materiales
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Materiales</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-3xl font-bold">{materials.length}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Movimientos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">0</div>
          </CardContent>
        </Card>

        <Card className="border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-600 dark:text-amber-400">
              Próximos a Vencer
            </CardTitle>
            <CalendarClock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">0</div>
          </CardContent>
        </Card>

      </div>

    </div>
  );
};

export default MaterialDashboard;