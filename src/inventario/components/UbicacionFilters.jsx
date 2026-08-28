import { memo } from "react";
import ComboboxField from "@/components/ui/combobox-field";

const UbicacionFilters = memo(
  ({
    ciudad,
    setCiudad,
    inmueble,
    setInmueble,
    nivel,
    setNivel,
    ambiente,
    setAmbiente,
    ciudadOptions,
    inmuebleOptionsByCiudad,
    nivelOptionsByInmueble,
    ambienteOptionsByNivel,
    className = "",
  }) => {
    const handleCiudadChange = (val) => {
      setCiudad(val);
      setInmueble("");
      setNivel("");
      setAmbiente("");
    };

    const handleInmuebleChange = (val) => {
      setInmueble(val);
      setNivel("");
      setAmbiente("");
    };

    const handleNivelChange = (val) => {
      setNivel(val);
      setAmbiente("");
    };

    return (
      <div className={`grid grid-cols-1 md:grid-cols-4 gap-4 ${className}`.trim()}>
        <ComboboxField
          label="Ciudad"
          value={ciudad}
          onValueChange={handleCiudadChange}
          options={ciudadOptions}
          placeholder="Seleccionar ciudad..."
          searchPlaceholder="Buscar ciudad..."
          emptyMessage="Sin resultados"
        />
        <ComboboxField
          label="Inmueble"
          value={inmueble}
          onValueChange={handleInmuebleChange}
          options={inmuebleOptionsByCiudad}
          placeholder="Seleccionar inmueble..."
          searchPlaceholder="Buscar inmueble..."
          emptyMessage="Sin resultados"
          wrapText
        />
        <ComboboxField
          label="Nivel"
          value={nivel}
          onValueChange={handleNivelChange}
          options={nivelOptionsByInmueble}
          placeholder="Seleccionar nivel..."
          searchPlaceholder="Buscar nivel..."
          emptyMessage="Sin resultados"
        />
        <ComboboxField
          label="Ambiente"
          value={ambiente}
          onValueChange={setAmbiente}
          options={ambienteOptionsByNivel}
          placeholder="Seleccionar ambiente..."
          searchPlaceholder="Buscar ambiente..."
          emptyMessage="Sin resultados"
          wrapText
        />
      </div>
    );
  },
);

UbicacionFilters.displayName = "UbicacionFilters";
export default UbicacionFilters;
