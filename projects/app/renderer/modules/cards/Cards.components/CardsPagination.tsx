import clsx from "clsx";

import { useBoundStore } from "~/renderer/store";

interface CardsPaginationProps {
  totalPages: number;
}

export const CardsPagination = ({ totalPages }: CardsPaginationProps) => {
  const {
    cards: { currentPage, setCurrentPage },
  } = useBoundStore();

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-center gap-2">
      <button
        className="btn btn-sm"
        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
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
              onClick={() => setCurrentPage(pageNum)}
            >
              {pageNum}
            </button>
          );
        })}
      </div>

      <button
        className="btn btn-sm"
        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
      >
        Next
      </button>
    </div>
  );
};
