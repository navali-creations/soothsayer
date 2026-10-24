import { useSetup } from "~/renderer/store";

import SetupClientPathSelector from "../SetupClientPathSelector/SetupClientPathSelector";

const SetupClientPathStep = () => {
  const { setupState, selectClientPath } = useSetup();

  const selectedGames = setupState?.selectedGames || [];
  const poe1ClientPath = setupState?.poe1ClientPath || "";
  const poe2ClientPath = setupState?.poe2ClientPath || "";

  const hasPoe1 = selectedGames.includes("poe1");
  const hasPoe2 = selectedGames.includes("poe2");
  const hasBoth = hasPoe1 && hasPoe2;

  const handlePoe1FileSelect = async () => {
    const filePath = await window.electron.selectFile({
      title: "Select Path of Exile 1 client log",
      filters: [{ name: "Text Files", extensions: ["txt"] }],
      properties: ["openFile"],
    });

    if (filePath) {
      await selectClientPath("poe1", filePath);
    }
  };

  const handlePoe2FileSelect = async () => {
    const filePath = await window.electron.selectFile({
      title: "Select Path of Exile 2 client log",
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
        Select client log location
      </h2>

      <p className="text-sm text-base-content/60 mb-3">
        Select Client.txt, or KakaoClient.txt if you use Kakao Games. Soothsayer
        uses the client log to track your divination card drops.
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
        <p>
          <span className="text-base-content/40">Kakao Games:</span>{" "}
          <code className="bg-base-300 px-1 py-0.5 rounded text-base-content/60">
            ...\Path of Exile
            {hasBoth && <span className="text-primary font-medium"> (2)</span>}
            {!hasBoth && hasPoe2 && " 2"}
            \logs\KakaoClient.txt
          </code>
        </p>
        {hasBoth && (
          <p className="text-base-content/40 italic mt-1">
            (2) = Path of Exile 2 folder
          </p>
        )}
      </div>

      {hasPoe1 && (
        <SetupClientPathSelector
          label="Path of Exile 1 client log"
          currentPath={poe1ClientPath}
          onSelectPath={handlePoe1FileSelect}
        />
      )}

      {hasPoe2 && (
        <SetupClientPathSelector
          label="Path of Exile 2 client log"
          currentPath={poe2ClientPath}
          onSelectPath={handlePoe2FileSelect}
        />
      )}
    </div>
  );
};

export default SetupClientPathStep;
