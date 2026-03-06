import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

import Button from "~/renderer/components/Button/Button";

interface SessionListPaginationProps {
  page: number;
  totalPages: number;
  isLoading: boolean;
  onPageChange: (newPage: number) => void;
}

/**
 * Pagination controls for the session list.
 *
 * Uses the app's `Button` component instead of raw `<button>` elements
 * for consistent styling across the application.
 */
const SessionListPagination = ({
  page,
  totalPages,
  isLoading,
  onPageChange,
}: SessionListPaginationProps) => {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between pt-1">
      <span className="text-xs text-base-content/40 tabular-nums">
        Page {page} of {totalPages}
      </span>
      <div className="join join-horizontal">
        <Button
          variant="ghost"
          size="xs"
          className="join-item"
          disabled={page <= 1 || isLoading}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <FiChevronLeft className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="xs"
          className="join-item"
          disabled={page >= totalPages || isLoading}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <FiChevronRight className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
};

export default SessionListPagination;
