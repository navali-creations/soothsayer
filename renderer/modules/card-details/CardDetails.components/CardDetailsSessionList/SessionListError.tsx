interface SessionListErrorProps {
  error: string;
}

/**
 * Error state for the session list panel.
 * Shown when session data fails to load.
 */
const SessionListError = ({ error }: SessionListErrorProps) => {
  return (
    <div className="bg-base-200 rounded-lg p-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase text-base-content/50">
        Sessions with this Card
      </h3>
      <p className="text-sm text-error">{error}</p>
    </div>
  );
};

export default SessionListError;
