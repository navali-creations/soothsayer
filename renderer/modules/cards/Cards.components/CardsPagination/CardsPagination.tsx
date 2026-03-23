import clsx from "clsx";

import { useBoundStore } from "~/renderer/store";

interface CardsPaginationProps {
  totalPages: number;
  onPageChange?: () => void;
}

export const CardsPagination = ({
  totalPages,
  onPageChange,
}: CardsPaginationProps) => {
  const {
    cards: { currentPage, setCurrentPage },
  } = useBoundStore();

  if (totalPages <= 1) {
    return null;
  }

  const goToPage = (page: number) => {
    setCurrentPage(page);
    onPageChange?.();
  };

  return (
    <div className="flex items-center justify-center gap-2">
      <button
        className="btn btn-sm"
        onClick={() => goToPage(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
      >
        Previous
      </button>

      <div className="flex gap-1">
        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
          let pageNum: number;
          if (totalPages <= 7) {
            pageNum = i + 1;
          } else if (currentPage <= 4) {
            pageNum = i + 1;
          } else if (currentPage >= totalPages - 3) {
            pageNum = totalPages - 6 + i;
          } else {
            pageNum = currentPage - 3 + i;
          }

          return (
            <button
              key={pageNum}
              className={clsx(
                "btn btn-sm",
                currentPage === pageNum && "btn-primary",
              )}
              onClick={() => goToPage(pageNum)}
            >
              {pageNum}
            </button>
          );
        })}
      </div>

      <button
        className="btn btn-sm"
        onClick={() => goToPage(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
      >
        Next
      </button>
    </div>
  );
};
