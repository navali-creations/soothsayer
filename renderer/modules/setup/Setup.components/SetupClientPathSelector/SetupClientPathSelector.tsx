interface SetupClientPathSelectorProps {
  label: string;
  currentPath: string;
  onSelectPath: () => void;
  required?: boolean;
}

const SetupClientPathSelector = ({
  label,
  currentPath,
  onSelectPath,
  required = true,
}: SetupClientPathSelectorProps) => {
  const hasPath = currentPath.length > 0;
  const showWarning = required && !hasPath;

  return (
    <div className="mb-3">
      <label className="label py-1">
        <span className="label-text text-sm text-base-content">{label}</span>
        {hasPath && <span className="text-xs text-success">✓</span>}
        {showWarning && <span className="text-xs text-warning">Required</span>}
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={currentPath}
          readOnly
          placeholder="No file selected"
          className={`input input-bordered input-sm flex-1 text-xs ${
            hasPath ? "input-success" : showWarning ? "input-warning" : ""
          }`}
        />
        <button
          type="button"
          onClick={onSelectPath}
          className="btn btn-primary btn-sm"
        >
          Browse
        </button>
      </div>
    </div>
  );
};

export default SetupClientPathSelector;
