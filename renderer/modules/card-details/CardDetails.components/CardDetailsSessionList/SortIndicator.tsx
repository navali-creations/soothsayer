import { FiChevronDown, FiChevronUp } from "react-icons/fi";

import type { SessionSortColumn, SessionSortState } from "./types";

interface SortIndicatorProps {
  column: SessionSortColumn;
  sortState: SessionSortState;
}

const SortIndicator = ({ column, sortState }: SortIndicatorProps) => {
  if (sortState.column !== column) {
    return (
      <span className="inline-flex ml-0.5 opacity-0 group-hover/th:opacity-40 transition-opacity">
        <FiChevronUp className="w-3 h-3" />
      </span>
    );
  }

  return (
    <span className="inline-flex ml-0.5 text-primary">
      {sortState.direction === "asc" ? (
        <FiChevronUp className="w-3 h-3" />
      ) : (
        <FiChevronDown className="w-3 h-3" />
      )}
    </span>
  );
};

export default SortIndicator;
