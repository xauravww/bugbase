"use client";

import { Button } from "@/components/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Pagination } from "@/types/milestone";

interface MilestonePaginationProps {
  pagination: Pagination;
  onPageChange: (page: number) => void;
}

export function MilestonePagination({ pagination, onPageChange }: MilestonePaginationProps) {
  const { page, totalPages, hasNext, hasPrev, total } = pagination;

  if (totalPages <= 1) {
    return (
      <div className="text-center py-4 text-sm text-[var(--color-text-secondary)]">
        Showing all {total} milestones
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between py-4 gap-4">
      <div className="text-sm text-[var(--color-text-secondary)] text-center sm:text-left">
        Showing page {page} of {totalPages} ({total} total milestones)
      </div>
      
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev}
          className="flex items-center gap-1 touch-target"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="mobile-hidden">Previous</span>
        </Button>
        
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum: number;
            
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (page <= 3) {
              pageNum = i + 1;
            } else if (page >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = page - 2 + i;
            }
            
            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`w-8 h-8 rounded text-sm touch-target ${
                  pageNum === page
                    ? "bg-[var(--color-accent)] text-white"
                    : "bg-white border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]"
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>
        
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext}
          className="flex items-center gap-1 touch-target"
        >
          <span className="mobile-hidden">Next</span>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}