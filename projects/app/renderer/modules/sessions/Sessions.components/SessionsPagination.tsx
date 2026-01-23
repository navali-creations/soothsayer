import {
  FiChevronsLeft,
  FiChevronsRight,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";
import { useBoundStore } from "~/renderer/store";
import { Button } from "../../../components";

export const SessionsPagination = () => {
  const {
    sessions: {
      getCurrentPage,
      getPageSize,
      getTotalPages,
      getTotalSessions,
      getFilteredSessions,
      setPage,
    },
  } = useBoundStore();

  const currentPage = getCurrentPage();
  const pageSize = getPageSize();
  const totalPages = getTotalPages();
  const totalSessions = getTotalSessions();
  const filteredSessions = getFilteredSessions();

  if (filteredSessions.length === 0) {
    return null;
  }

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalSessions);

  return (
    <div className="flex items-center justify-between gap-2 mt-4">
      <div className="text-sm text-base-content/70">
        Showing {startItem} to {endItem} of {totalSessions} sessions
      </div>

      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setPage(1)}
          disabled={currentPage === 1}
        >
          <FiChevronsLeft />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setPage(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <FiChevronLeft />
        </Button>
        <div className="flex items-center gap-2 px-3">
          <span className="text-sm">
            Page {currentPage} of {totalPages}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setPage(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          <FiChevronRight />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setPage(totalPages)}
          disabled={currentPage === totalPages}
        >
          <FiChevronsRight />
        </Button>
      </div>
    </div>
  );
};
