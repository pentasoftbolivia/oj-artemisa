const FK_MAP = {
  cirun: "cirun",
  codigo: "codigo",
  paterno: "paterno",
  materno: "materno",
  nombres: "nombres",
  ciexp: "ciexp",
  dirz: "dirz",
  dirc: "dirc",
  fecnac: "fecnac",
  tel: "tel",
  cel: "cel",
  ec: "ec",
  ts: "ts",
  sexo: "sexo",
  nac: "nac",
  ln: "ln",
  lm: "lm",
  cba: "cba",
  banco: "banco",
  acaja: "acaja",
  afp: "afp",
  mat: "mat",
  fsys: "fsys",
  codigoambiente: "codigoambiente",
  ambiente: "ambiente",
  codigonivel: "codigonivel",
  codigoinstitucion: "codigoinstitucion",
  login_sid: "login_sid",
  usuarioregistro: "usuarioregistro",
  fecharegistro: "fecharegistro",
  registroactivo: "registroactivo",
  codigociudad: "codigociudad",
  codigounidadejecutora: "codigounidadejecutora",
  descripcion: "descripcion",
  codigoActivoInterno: "codigoactivointerno",
  codigoActivo: "codigoactivo",
  codigoTransaccion: "codigotransaccion",
  descripcionActivo: "descripcionactivo",
  valorRevaluo: "valorrevaluo",
  valorInicial: "valorinicial",
  vidaUtilInicial: "vidautilinicial",
  valorActual: "valoractual",
  vidUtilActual: "vidutilactual",
  resolucionAmparo: "resolucionamparo",
  valorNominal: "valornominal",
  calActualizacionBs1: "cal_actualizacionbs1",
  calActualizacionBs2: "cal_actualizacionbs2",
  tipoRubroAct: "tiporubroact",
  codigoUnidad: "codigounidad",
  marcaMaterial: "marcamaterial",
  numeroFactura: "numerofactura",
  fechaInicial: "finicial",
  incActGestion: "incactgestion",
  depGes: "depges",
  valorNeto: "valorneto",
  porDepAnu: "pordepanu",
  valorIniGest: "valorinigest",
  facGestion: "facgestion",
  facTotal: "factotal",
  vidUtilCons: "vidutilcons",
  vidUtilConGes: "vidutilconges",
  vidUtilTot: "vidutiltot",
  vidUtilRest: "vidutilrest",
  tcHoyUfv: "tchoyufv",
  tcGestionUfv: "tcgestionufv",
  tcCompraUfv: "tccompraufv",
  saldoInicialExp: "saldoinicial_exp",
  depAcumExp: "depacum_exp",
  actualizExp: "actualiz_exp",
  costActualiExp: "costactuali_exp",
  actDepAcumExp: "actdepacum_exp",
  vidUtilOriginal: "vidutiloriginal",
  fechaOriginal: "fechaoriginal",
  depAcumTotalExp: "depacumtotal_exp",
  dep2003: "dep2003",
  costAct2003: "costact2003",
  costoHistorico: "costohistorico",
  saldoInciialExp: "saldoinciial_exp",
  saldoIncialExp: "saldoincial_exp",
  cosComRevExp: "coscomrev_exp",
  idBien: "idbien",
  usuarioRegistro: "usuarioregistro",
  fechaRegistro: "fecharegistro",
  codigoinmueble: "codigoinmueble",
  inmueble: "inmueble",
  codigolocalidad: "codigolocalidad",
  codigonivel: "codigonivel",
  nivel: "nivel",
  codigorubroact: "codigorubroact",
  descripcionrubroact: "descripcionrubroact",
  vidautil: "vidautil",
  coheficiente: "coheficiente",
  tipo: "tipo",
  tiporubroact: "tiporubroact",
  descripciontiporubroact: "descripciontiporubroact",
  nombreCompleto: "nombre_completo",
  entidadId: "entidad_id",
  unidadId: "unidad_id",
  cargoId: "cargo_id",
  municipioId: "municipio_id",
  codigoIso: "codigo_iso",
  paisId: "pais_id",
  departamentoId: "departamento_id",
  provinciaId: "provincia_id",
  anteriorId: "anterior_id",
  idBien: "id_bien",
  tipoActivoId: "tipo_activo_id",
  partidaId: "partida_id",
  proveedorId: "proveedor_id",
  estadoActivoId: "estado_activo_id",
  ubicacionActualId: "ubicacion_actual_id",
  depositoActualId: "deposito_actual_id",
  funcionarioCustodioId: "funcionario_custodio_id",
  codigoPatrimonial: "codigo_patrimonial",
  codigoAnterior: "codigo_anterior",
  numeroPlaca: "numero_placa",
  numeroSerie: "numero_serie",
  numeroInventario: "numero_inventario",
  codigoBarra: "codigo_barra",
  codigoQr: "codigo_qr",
  anioFabricacion: "anio_fabricacion",
  formaAdquisicion: "forma_adquisicion",
  numeroDocumentoOrigen: "numero_documento_origen",
  fechaAdquisicion: "fecha_adquisicion",
  fechaIngresoSistema: "fecha_ingreso_sistema",
  fechaInicioDepreciacion: "fecha_inicio_depreciacion",
  valorAdquisicion: "valor_adquisicion",
  valorResidual: "valor_residual",
  vidaUtilAnios: "vida_util_anios",
  tasaDepreciacion: "tasa_depreciacion",
  metodoDepreciacion: "metodo_depreciacion",
  depreciacionAcumulada: "depreciacion_acumulada",
  valorLibros: "valor_libros",
  condicionFisica: "condicion_fisica",
  enGarantia: "en_garantia",
  fechaFinGarantia: "fecha_fin_garantia",
  imagenUrl: "imagen_url",
  documentoUrl: "documento_url",
  pesoKg: "peso_kg",
  tipoEntidad: "tipo_entidad",
  funcionarioId: "funcionario_id",
  activoId: "activo_id",
  fechaAsignacion: "fecha_asignacion",
  fechaDevolucion: "fecha_devolucion",
  ubicacionId: "ubicacion_id",
  movimientoAsigId: "movimiento_asig_id",
};

const REVERSE_MAP = {};
for (const [camel, snake] of Object.entries(FK_MAP)) {
  REVERSE_MAP[snake] = camel;
}

export const toSnakeCase = (data) => {
  const result = { ...data };
  for (const [camel, snake] of Object.entries(FK_MAP)) {
    if (camel === snake) continue;
    if (camel in result) {
      result[snake] = result[camel];
      delete result[camel];
    }
  }
  return result;
};

export const toCamelCase = (data) => {
  if (!data) return data;
  const result = { ...data };
  for (const [snake, camel] of Object.entries(REVERSE_MAP)) {
    if (snake === camel) continue;
    if (snake in result) {
      result[camel] = result[snake];
      delete result[snake];
    }
  }
  return result;
};

export const toCamelCaseArray = (arr) => {
  if (!arr) return arr;
  return arr.map(toCamelCase);
};
