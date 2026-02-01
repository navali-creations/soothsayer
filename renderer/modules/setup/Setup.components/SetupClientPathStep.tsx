import { useBoundStore } from "~/renderer/store";

interface ClientPathSelectorProps {
  label: string;
  currentPath: string;
  onSelectPath: () => void;
  required?: boolean;
}

const ClientPathSelector = ({
  label,
  currentPath,
  onSelectPath,
  required = true,
}: ClientPathSelectorProps) => {
  const hasPath = currentPath && currentPath.length > 0;
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
        <button onClick={onSelectPath} className="btn btn-primary btn-sm">
          Browse
        </button>
      </div>
    </div>
  );
};

const SetupClientPathStep = () => {
  const {
    setup: { setupState, selectClientPath },
  } = useBoundStore();

  const selectedGames = setupState?.selectedGames || [];
  const poe1ClientPath = setupState?.poe1ClientPath || "";
  const poe2ClientPath = setupState?.poe2ClientPath || "";

  const hasPoe1 = selectedGames.includes("poe1");
  const hasPoe2 = selectedGames.includes("poe2");
  const hasBoth = hasPoe1 && hasPoe2;

  const handlePoe1FileSelect = async () => {
    const filePath = await window.electron.selectFile({
      title: "Select Path of Exile 1 Client.txt",
      filters: [{ name: "Text Files", extensions: ["txt"] }],
      properties: ["openFile"],
    });

    if (filePath) {
      await selectClientPath("poe1", filePath);
    }
  };

  const handlePoe2FileSelect = async () => {
    const filePath = await window.electron.selectFile({
      title: "Select Path of Exile 2 Client.txt",
      filters: [{ name: "Text Files", extensions: ["txt"] }],
      properties: ["openFile"],
    });

    if (filePath) {
      await selectClientPath("poe2", filePath);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-base-content mb-1">
        Select Client.txt location
      </h2>

      <p className="text-sm text-base-content/60 mb-3">
        This file is used to track your divination card drops.
      </p>

      <div className="mb-3 p-2 bg-base-100 border border-base-content/10 rounded-lg text-xs space-y-1">
        <p className="text-base-content/70 font-medium">Typical locations:</p>
        <p>
          <span className="text-base-content/40">Steam:</span>{" "}
          <code className="bg-base-300 px-1 py-0.5 rounded text-base-content/60">
            C:\Program Files (x86)\Steam\steamapps\common\Path of Exile
            {hasBoth && <span className="text-primary font-medium"> (2)</span>}
            {!hasBoth && hasPoe2 && " 2"}
            \logs\Client.txt
          </code>
        </p>
        <p>
          <span className="text-base-content/40">Standalone:</span>{" "}
          <code className="bg-base-300 px-1 py-0.5 rounded text-base-content/60">
            C:\Program Files (x86)\Grinding Gear Games\Path of Exile
            {hasBoth && <span className="text-primary font-medium"> (2)</span>}
            {!hasBoth && hasPoe2 && " 2"}
            \logs\Client.txt
          </code>
        </p>
        {hasBoth && (
          <p className="text-base-content/40 italic mt-1">
            (2) = Path of Exile 2 folder
          </p>
        )}
      </div>

      {hasPoe1 && (
        <ClientPathSelector
          label="Path of Exile 1 Client.txt"
          currentPath={poe1ClientPath}
          onSelectPath={handlePoe1FileSelect}
        />
      )}

      {hasPoe2 && (
        <ClientPathSelector
          label="Path of Exile 2 Client.txt"
          currentPath={poe2ClientPath}
          onSelectPath={handlePoe2FileSelect}
        />
      )}
    </div>
  );
};

export default SetupClientPathStep;
