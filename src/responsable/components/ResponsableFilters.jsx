import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, X } from "lucide-react";

const ResponsableFilters = memo(({
  filters,
  hasActiveFilters,
  cargos,
  onFilterChange,
  onClearFilters,
  messages
}) => {
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="h-4 w-4" />
          Filtros
        </CardTitle>
        {hasActiveFilters ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            title="Limpiar filtros"
            className="h-8"
          >
            <X className="h-4 w-4 mr-2" />
            Limpiar
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="search">Buscar</Label>
            <Input
              id="search"
              placeholder={messages.placeholders.search}
              value={filters.search}
              onChange={(e) => onFilterChange("search", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cargo">Cargo</Label>
            <Select
              value={filters.cargo}
              onValueChange={(value) => onFilterChange("cargo", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={messages.placeholders.cargo} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {messages.placeholders.cargo}
                </SelectItem>
                {cargos.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

ResponsableFilters.displayName = "ResponsableFilters";
export default ResponsableFilters;
