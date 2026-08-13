import { memo, useCallback, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TableEditor = memo(({
  title,
  description,
  placeholder,
  icon,
  fields,
  find,
  update,
}) => {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("idle");
  const [form, setForm] = useState(null);
  const [current, setCurrent] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSearch = useCallback(async () => {
    setStatus("loading");
    setForm(null);
    setCurrent(null);
    try {
      const record = await find(query.trim());
      if (!record) {
        setStatus("notfound");
        return;
      }
      const normalized = {};
      fields.forEach((f) => {
        normalized[f.id] = record[f.id] != null ? String(record[f.id]) : "";
      });
      setForm(normalized);
      setCurrent(record);
      setStatus("found");
    } catch (err) {
      console.error(`Error al buscar en ${title}:`, err);
      setStatus("notfound");
      toast({
        title: "Error",
        description: `No se pudo buscar: ${err.message || "Error desconocido"}`,
        variant: "destructive",
      });
    }
  }, [find, fields, toast, title, query]);

  const handleChange = useCallback((id, value) => {
    setForm((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!current) return;
    setSaving(true);
    try {
      const payload = {};
      fields
        .filter((f) => !f.readOnly)
        .forEach((f) => {
          const value = form[f.id];
          if (f.type === "number" || f.numeric) {
            payload[f.id] = value === "" ? null : Number(value);
          } else {
            payload[f.id] = value;
          }
        });
      await update(current, payload);
      toast({ title: "¡Éxito!", description: `${title} actualizado correctamente.` });
    } catch (err) {
      console.error(`Error al guardar en ${title}:`, err);
      toast({
        title: "Error",
        description: `Fallo al guardar: ${err.message || "Error desconocido"}`,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }, [current, form, fields, update, toast, title]);

  const editableFields = fields.filter((f) => !f.readOnly);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4 flex-1">
        <div className="space-y-2">
          <Label htmlFor={`${title}-query`}>Buscar</Label>
          <div className="flex gap-2">
            <Input
              id={`${title}-query`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
              disabled={status === "loading"}
            />
            <Button
              onClick={handleSearch}
              disabled={status === "loading" || !query.trim()}
              size="icon"
              aria-label="Buscar"
            >
              {status === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {status === "loading" ? (
          <div className="text-sm text-muted-foreground animate-pulse py-6 text-center">
            Buscando...
          </div>
        ) : status === "notfound" ? (
          <div className="text-center text-sm text-muted-foreground py-6 border rounded-md">
            No se encontró el registro
          </div>
        ) : status === "found" && form ? (
          <div className="grid gap-3">
            {fields.map((f) => (
              <div key={f.id} className="space-y-1.5">
                <Label htmlFor={`${title}-${f.id}`}>{f.label}</Label>
                {f.type === "select" ? (
                  <Select
                    value={form[f.id] || ""}
                    onValueChange={(value) => handleChange(f.id, value)}
                    disabled={saving || f.readOnly}
                  >
                    <SelectTrigger className="w-full [&>span]:line-clamp-1 text-left">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(f.options || []).map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={`${title}-${f.id}`}
                    type={f.type === "number" ? "number" : "text"}
                    value={form[f.id] || ""}
                    onChange={(e) => handleChange(f.id, e.target.value)}
                    disabled={saving || f.readOnly}
                  />
                )}
              </div>
            ))}
            <Button onClick={handleSave} disabled={saving || editableFields.length === 0} className="mt-2">
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Guardar
            </Button>
          </div>
        ) : (
          <div className="text-center text-sm text-muted-foreground py-6 border rounded-md">
            Ingrese un criterio y presione Buscar
          </div>
        )}
      </CardContent>
    </Card>
  );
});

TableEditor.displayName = "TableEditor";
export default TableEditor;