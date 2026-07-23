const InicioPage = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4">
      <div className="max-w-2xl text-center space-y-6">
        <img
          src="/logo-oj.png"
          alt="Órgano Judicial - La Paz"
          className="h-24 w-auto mx-auto"
        />
        <p className="text-lg md:text-xl font-semibold text-gray-700 leading-relaxed">
          SERVICIO DE CONSULTORÍA PARA LA INVENTARIACIÓN, IDENTIFICACIÓN,
          RECODIFICACIÓN CLASIFICACIÓN Y REVALÚO TÉCNICO DE LOS ACTIVOS FIJOS
          DEL ÓRGANO JUDICIAL - DISTRITAL LA PAZ
        </p>
      </div>
    </div>
  );
};

export default InicioPage;
