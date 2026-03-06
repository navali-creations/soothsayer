/**
 * Empty state for the session list.
 * Shown when the card hasn't appeared in any sessions.
 */
const SessionListEmpty = () => {
  return (
    <div className="bg-base-200 rounded-lg p-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase text-base-content/50">
        Sessions with this Card
      </h3>
      <p className="text-sm text-base-content/50">
        This card hasn't appeared in any of your sessions yet.
      </p>
    </div>
  );
};

export default SessionListEmpty;
