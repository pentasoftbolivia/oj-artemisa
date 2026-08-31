import { Boxes, Users, ArrowLeftRight } from "lucide-react";
import TableEditor from "../components/TableEditor";
import AmbienteEditor from "../components/AmbienteEditor";
import {
  findActivo,
  updateActivo,
  findResponsable,
  updateResponsable,
  findTransferencia,
  updateTransferencia,
} from "../services/transferenciaEditorService";

const SI_NO_OPTIONS = [
  { value: "1", label: "Activo" },
  { value: "0", label: "Inactivo" },
];

const ESTADO_INVENTARIO_OPTIONS = [
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "EN PROCESO", label: "En Proceso" },
  { value: "INVENTARIADO", label: "Inventariado" },
  { value: "REVISADO", label: "Revisado" },
  { value: "ENVIADO", label: "Enviado" },
];

const EDITORS = [
  {
    title: "Activos",
    description: "Busca por código de activo (último registro)",
    placeholder: "Código de activo...",
    icon: <Boxes className="h-4 w-4" />,
    find: findActivo,
    update: updateActivo,
    fields: [
      { id: "codigoactivointerno", label: "Código Interno", type: "number", readOnly: true },
      { id: "codigoactivo", label: "Código Activo", type: "number", readOnly: true },
      { id: "codigotransaccion", label: "Código Transacción", type: "number" },
      { id: "codigoambiente", label: "Código Ambiente" },
      { id: "cirun", label: "Carnet" },
      { id: "estadoinventario", label: "Estado", type: "select", options: ESTADO_INVENTARIO_OPTIONS },
    ],
  },
  {
    title: "Responsables",
    description: "Busca por carnet de responsable",
    placeholder: "Carnet (CI)...",
    icon: <Users className="h-4 w-4" />,
    find: findResponsable,
    update: updateResponsable,
    fields: [
      { id: "cirun", label: "Carnet", readOnly: true },
      { id: "nombre1", label: "Primer Nombre" },
      { id: "nombre2", label: "Segundo Nombre" },
      { id: "paterno", label: "Apellido Paterno" },
      { id: "materno", label: "Apellido Materno" },
      { id: "cargo", label: "Cargo" },
      { id: "estado", label: "Estado", type: "select", numeric: true, options: SI_NO_OPTIONS },
    ],
  },
  {
    title: "Transferencias",
    description: "Busca por código de transacción",
    placeholder: "Código de transacción...",
    icon: <ArrowLeftRight className="h-4 w-4" />,
    find: findTransferencia,
    update: updateTransferencia,
    fields: [
      { id: "codigotransaccion", label: "Código Transacción", type: "number", readOnly: true },
      { id: "responsableinicial", label: "Responsable Inicial" },
      { id: "responsablefinal", label: "Responsable Final" },
      { id: "ubicacioninicial", label: "Ubicación Inicial" },
      { id: "ubicacionfinal", label: "Ubicación Final" },
    ],
  },
];

const ConfigTransferenciaList = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Actualización Transferencias
        </h1>
        <p className="text-muted-foreground">
          Busca, edita y guarda registros en sus respectivas tablas
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        {EDITORS.slice(0, 1).map((editor) => (
          <TableEditor key={editor.title} {...editor} />
        ))}
        {EDITORS.slice(1, 2).map((editor) => (
          <TableEditor key={editor.title} {...editor} />
        ))}
        <AmbienteEditor />
        {EDITORS.slice(2).map((editor) => (
          <TableEditor key={editor.title} {...editor} />
        ))}
      </div>
    </div>
  );
};

export default ConfigTransferenciaList;