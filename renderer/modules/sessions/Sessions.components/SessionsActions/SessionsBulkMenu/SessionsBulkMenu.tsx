import { FiDownload, FiMoreHorizontal, FiTrash2 } from "react-icons/fi";

import { useSessions } from "~/renderer/store";

export const SessionsBulkMenu = () => {
  const { setBulkMode } = useSessions();

  const handleSimpleExport = () => {
    setBulkMode("export-simple");
  };

  const handleRichExport = () => {
    setBulkMode("export-rich");
  };

  const handleDelete = () => {
    setBulkMode("delete");
  };

  return (
    <div className="dropdown dropdown-end z-50">
      <button
        type="button"
        aria-label="More session options"
        className="btn btn-sm btn-primary btn-square"
      >
        <FiMoreHorizontal size={16} />
      </button>
      <ul
        tabIndex={0}
        className="dropdown-content menu w-64 rounded-box bg-base-200 p-2 shadow-xl shadow-black/50"
      >
        <li>
          <button
            aria-describedby="simple-export-description"
            aria-label="Export Simple CSV"
            className="w-full justify-between gap-3 py-2"
            onClick={handleSimpleExport}
          >
            <FiDownload className="shrink-0" size={14} />
            <span className="flex min-w-0 flex-col items-end text-right leading-tight">
              <span>Export Simple CSV</span>
              <span
                id="simple-export-description"
                className="text-xs font-normal text-base-content/50"
              >
                Card name + total amount
              </span>
            </span>
          </button>
        </li>
        <li>
          <button
            aria-describedby="rich-export-description"
            aria-label="Export Rich CSV"
            className="w-full justify-between gap-3 py-2"
            onClick={handleRichExport}
          >
            <FiDownload className="shrink-0" size={14} />
            <span className="flex min-w-0 flex-col items-end text-right leading-tight">
              <span>Export Rich CSV</span>
              <span
                id="rich-export-description"
                className="text-xs font-normal text-base-content/50"
              >
                Full session details per row
              </span>
            </span>
          </button>
        </li>
        <li role="separator" className="my-1 border-t border-base-content/15" />
        <li>
          <button
            aria-describedby="delete-sessions-description"
            aria-label="Delete sessions"
            className="w-full justify-between gap-3 py-2 text-error"
            onClick={handleDelete}
          >
            <FiTrash2 className="shrink-0" size={14} />
            <span className="flex min-w-0 flex-col items-end text-right leading-tight">
              <span>Delete sessions</span>
              <span
                id="delete-sessions-description"
                className="text-xs font-normal opacity-60"
              >
                Choose which sessions to delete
              </span>
            </span>
          </button>
        </li>
      </ul>
    </div>
  );
};
