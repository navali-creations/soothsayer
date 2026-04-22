import clsx from "clsx";

import { useSessions } from "~/renderer/store";

import { SessionCard } from "../SessionsCard/SessionsCard";

export const SessionsGrid = () => {
  const {
    getFilteredSessions,
    getSelectedLeague,
    getSparklines,
    getIsBulkMode,
    getIsDeleteMode,
    getIsSessionSelected,
    toggleSessionSelection,
  } = useSessions();

  const filteredSessions = getFilteredSessions();
  const selectedLeague = getSelectedLeague();
  const sparklines = getSparklines();
  const isBulkMode = getIsBulkMode();
  const isDeleteMode = getIsDeleteMode();

  if (filteredSessions.length === 0) {
    return (
      <div className="text-center py-12 text-base-content/50 animation-fade-in">
        <p className="text-lg">No sessions found</p>
        <p className="text-sm">
          {selectedLeague === "all"
            ? "Start a session from the Current Session page to begin tracking"
            : `No sessions found for ${selectedLeague} league`}
        </p>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-4 gap-4 mt-2">
      {filteredSessions.map((session) => {
        const selected = isBulkMode
          ? getIsSessionSelected(session.sessionId)
          : false;

        return (
          <li
            className="animation-stagger relative"
            key={`${selectedLeague}-${session.sessionId}`}
          >
            {isBulkMode && (
              <div className="absolute -top-2.5 -right-2 z-30">
                <input
                  type="checkbox"
                  className={clsx(
                    "checkbox checkbox-sm bg-base-200 shadow-md b border-2",
                    isDeleteMode ? "checkbox-error" : "checkbox-primary",
                    isDeleteMode && "checked:text-white",
                    !selected && "border-dashed border-base-content/30",
                  )}
                  checked={selected}
                  onChange={() => toggleSessionSelection(session.sessionId)}
                />
              </div>
            )}
            <SessionCard
              session={session}
              linePoints={sparklines[session.sessionId]}
            />
          </li>
        );
      })}
    </ul>
  );
};
