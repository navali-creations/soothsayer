import clsx from "clsx";

import { useSessions } from "~/renderer/store";

import { SessionCard } from "../SessionsCard/SessionsCard";

export const SessionsGrid = () => {
  const {
    getFilteredSessions,
    getSelectedLeague,
    getSparklines,
    getIsExportMode,
    getIsSessionSelected,
    toggleSessionSelection,
  } = useSessions();

  const filteredSessions = getFilteredSessions();
  const selectedLeague = getSelectedLeague();
  const sparklines = getSparklines();
  const isExportMode = getIsExportMode();

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
        const selected = isExportMode
          ? getIsSessionSelected(session.sessionId)
          : false;

        return (
          <li
            className="animation-stagger relative"
            key={`${selectedLeague}-${session.sessionId}`}
          >
            {isExportMode && (
              <div className="absolute -top-2.5 -right-2 z-30">
                <input
                  type="checkbox"
                  className={clsx(
                    "checkbox checkbox-primary checkbox-sm bg-base-200 shadow-md b border-2",
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
              isExportMode={isExportMode}
              isSelected={selected}
              onToggleSelect={() => toggleSessionSelection(session.sessionId)}
            />
          </li>
        );
      })}
    </ul>
  );
};
