import { useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

const PAGE_SIZE_OPTIONS = [50, 100, 200, 500];

const DataPagination = ({ currentPage, totalPages, totalCount, pageSize, onPageChange, onPageSizeChange }) => {
  const safeCurrentPage = useMemo(
    () => Math.min(currentPage, totalPages),
    [currentPage, totalPages]
  );

  const getPageNumbers = useCallback(() => {
    const pages = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safeCurrentPage > 3) pages.push("...");
      const start = Math.max(2, safeCurrentPage - 1);
      const end = Math.min(totalPages - 1, safeCurrentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (safeCurrentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  }, [totalPages, safeCurrentPage]);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Mostrar</span>
        <Select value={pageSize.toString()} onValueChange={(v) => onPageSizeChange(Number(v))}>
          <SelectTrigger className="h-8 w-[80px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt.toString()}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span>por página</span>
      </div>

      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <span>
          {totalCount === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1}
          {" — "}
          {Math.min(safeCurrentPage * pageSize, totalCount)}
          {" de "}
          {totalCount} registros
        </span>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={safeCurrentPage === 1} onClick={() => onPageChange(1)} title="Primera página">
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={safeCurrentPage === 1} onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))} title="Página anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {getPageNumbers().map((page, idx) =>
          page === "..." ? (
            <span key={`ellipsis-${idx}`} className="px-1 text-muted-foreground">...</span>
          ) : (
            <Button key={page} variant={safeCurrentPage === page ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => onPageChange(page)}>
              {page}
            </Button>
          )
        )}

        <Button variant="outline" size="icon" className="h-8 w-8" disabled={safeCurrentPage === totalPages} onClick={() => onPageChange(Math.min(totalPages, safeCurrentPage + 1))} title="Página siguiente">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={safeCurrentPage === totalPages} onClick={() => onPageChange(totalPages)} title="Última página">
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default DataPagination;
