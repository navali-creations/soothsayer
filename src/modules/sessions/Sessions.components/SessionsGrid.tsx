import { useBoundStore } from "../../../store/store";
import { SessionCard } from "./SessionsCard";

export const SessionsGrid = () => {
  const {
    sessions: { getFilteredSessions, getSelectedLeague },
  } = useBoundStore();

  const filteredSessions = getFilteredSessions();
  const selectedLeague = getSelectedLeague();

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
    <ul className="grid grid-cols-4 gap-4">
      {filteredSessions.map((session) => (
        <li
          className="animation-stagger"
          key={`${selectedLeague}-${session.sessionId}`}
        >
          <SessionCard session={session} />
        </li>
      ))}
    </ul>
  );
};
