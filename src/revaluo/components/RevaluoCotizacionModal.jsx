import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, Trash2 } from "lucide-react";
import LoadingSpinner from "@/components/ui/loading-spinner";

const RevaluoCotizacionModal = ({
  isOpen,
  onClose,
  activo,
  cotIndex,
  empresa,
  files = [],
  isLoading = false,
  isUploading = false,
  onUpload,
  onDelete,
}) => {
  const fileInputRef = useRef(null);
  const [isDeleting, setIsDeleting] = useState(null);

  const codigoLabel = activo?._codigoActivo || (activo?.codigoActivo ? `OJ-02-${activo.codigoActivo}` : "—");

  const handleFiles = (e) => {
    const list = Array.from(e.target.files || []);
    if (list.length === 0) return;
    onUpload?.(list);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = async (name) => {
    setIsDeleting(name);
    try {
      await onDelete?.(name);
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose?.(); }}>
      <DialogContent className="w-[96vw] sm:max-w-[720px] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base sm:text-lg leading-tight">
            Respaldo N° Cotización {cotIndex} — {codigoLabel}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm leading-tight">
            {empresa ? (
              <>Empresa: <span className="font-semibold">{empresa}</span> · Nombre foto: <span className="font-mono">{activo?.codigoActivo}_{empresa.replace(/\s+/g, "_").toUpperCase().slice(0, 30)}_COT{cotIndex}_...</span></>
            ) : (
              <>Escriba el nombre de la empresa en la columna antes de subir fotos.</>
            )}
            {` · ${files.length} foto(s)`}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple className="hidden" onChange={handleFiles} disabled={isUploading} />
          <Button
            variant="outline"
            size="sm"
            className="bg-orange-500 text-white hover:bg-orange-600 hover:text-white w-full sm:w-auto min-h-11"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || isUploading || !empresa?.trim()}
            title={!empresa?.trim() ? "Escriba la empresa en la columna N° Cotización" : "Subir fotos"}
          >
            {isUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {isUploading ? "Subiendo..." : "Subir fotos (varias)"}
          </Button>
          {!empresa?.trim() && (
            <p className="text-[11px] text-red-600 mt-1">Primero escriba el nombre de la empresa en la subcolumna {cotIndex}.</p>
          )}
        </div>

        <div className="py-2 max-h-[55vh] overflow-y-auto">
          {isLoading ? (
            <LoadingSpinner />
          ) : files.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">Sin fotos de respaldo para esta subcolumna.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {files.map((file) => {
                const isImg = /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name);
                return (
                  <div key={file.name} className="border rounded-lg overflow-hidden">
                    {isImg ? (
                      <a href={file.url} target="_blank" rel="noopener noreferrer">
                        <img src={file.url} alt={file.name} loading="lazy" className="w-full h-36 object-cover hover:opacity-80 bg-muted" />
                      </a>
                    ) : (
                      <a href={file.url} target="_blank" rel="noopener noreferrer" className="w-full h-36 flex items-center justify-center bg-muted text-xs font-mono p-2 text-center break-all">
                        {file.name}
                      </a>
                    )}
                    <div className="p-2 bg-muted/20">
                      <div className="text-[10px] font-mono truncate" title={file.name}>{file.name}</div>
                      <div className="flex justify-end mt-1">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600 hover:text-red-800" onClick={() => handleDelete(file.name)} disabled={isDeleting === file.name} title="Eliminar">
                          {isDeleting === file.name ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RevaluoCotizacionModal;
