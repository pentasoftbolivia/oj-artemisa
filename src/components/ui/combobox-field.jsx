import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Search, Loader2 } from "lucide-react";

const ComboboxField = ({
  value,
  onValueChange,
  options = [],
  placeholder = "Seleccionar...",
  searchPlaceholder = "Buscar...",
  label,
  disabled = false,
  loading = false,
  error,
  emptyMessage = "Sin resultados",
  className,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchInputRef = useRef(null);
  const containerRef = useRef(null);

  const selectedLabel = useMemo(() => {
    if (!value) return "";
    const opt = options.find((o) => o.value === value);
    return opt ? opt.label : "";
  }, [value, options]);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  useEffect(() => {
    if (open) {
      setSearch("");
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }
  }, [open]);

  const handleSelect = useCallback(
    (selectedValue) => {
      onValueChange(selectedValue);
      setOpen(false);
      setSearch("");
    },
    [onValueChange]
  );

  return (
    <div className={cn("space-y-2", className)}>
      {label && <Label>{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild disabled={disabled || loading}>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || loading}
            className={cn(
              "w-full justify-between font-normal",
              !value && "text-muted-foreground",
              error && "border-red-500"
            )}
          >
            {loading ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando...
              </span>
            ) : value && selectedLabel ? (
              <span className="truncate">{selectedLabel}</span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0"
          align="start"
          sideOffset={4}
          style={{ width: "var(--radix-popover-trigger-width)" }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div ref={containerRef}>
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <Input
                ref={searchInputRef}
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-0 bg-transparent p-0 py-3 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
            <div className="max-h-[260px] overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </div>
              ) : (
                filteredOptions.map((opt) => (
                  <div
                    key={opt.value}
                    role="option"
                    aria-selected={value === opt.value}
                    className={cn(
                      "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                      value === opt.value && "bg-accent text-accent-foreground"
                    )}
                    onClick={() => handleSelect(opt.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === opt.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{opt.label}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
};

export default ComboboxField;
