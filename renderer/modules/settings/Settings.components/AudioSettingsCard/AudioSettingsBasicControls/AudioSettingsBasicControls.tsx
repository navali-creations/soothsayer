import { type ChangeEvent, useCallback } from "react";
import { FiFolder, FiRefreshCw } from "react-icons/fi";

import { Button } from "~/renderer/components";
import { trackEvent } from "~/renderer/modules/umami";
import { useSettingsShallow } from "~/renderer/store";

export function AudioSettingsBasicControls() {
  const {
    audioEnabled,
    audioVolume,
    audioIsScanning,
    detectedFileCount,
    scanCustomSounds,
    updateSetting,
  } = useSettingsShallow((settings) => ({
    audioEnabled: settings.audioEnabled,
    audioVolume: settings.audioVolume,
    audioIsScanning: settings.audioIsScanning,
    detectedFileCount: settings.audioDetectedFiles.length,
    scanCustomSounds: settings.scanCustomSounds,
    updateSetting: settings.updateSetting,
  }));
  const volumePercent = Math.round(audioVolume * 100);

  const handleEnabledChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const enabled = event.target.checked;
      void updateSetting("audioEnabled", enabled);
      trackEvent("settings-change", {
        setting: "audioEnabled",
        value: enabled,
      });
    },
    [updateSetting],
  );

  const handleVolumeChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      void updateSetting("audioVolume", parseFloat(event.target.value));
    },
    [updateSetting],
  );

  const handleScan = useCallback(async () => {
    await scanCustomSounds();
    trackEvent("audio-scan-custom-sounds");
  }, [scanCustomSounds]);

  const handleOpenFolder = useCallback(async () => {
    await window.electron.settings.openCustomSoundsFolder();
    trackEvent("audio-open-sounds-folder");
  }, []);

  return (
    <div className="space-y-4">
      <div className="form-control">
        <label className="label cursor-pointer justify-start gap-4">
          <span className="label-text flex-1">Enable drop sounds</span>
          <input
            type="checkbox"
            className="toggle toggle-sm toggle-primary"
            checked={audioEnabled}
            onChange={handleEnabledChange}
          />
        </label>
      </div>

      <div className="form-control">
        <div className="flex items-center gap-3">
          <span className="text-sm text-base-content/70 min-w-13">Volume</span>
          <input
            type="range"
            className="range range-primary range-xs flex-1 disabled:opacity-40"
            min={0}
            max={1}
            step={0.05}
            value={audioVolume}
            disabled={!audioEnabled}
            onChange={handleVolumeChange}
          />
          <span className="text-sm font-mono text-base-content/70 min-w-9.5 text-right tabular-nums">
            {volumePercent}%
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="sr-only">Custom Sounds</h3>
        <p className="text-sm text-base-content/70">
          Use your own{" "}
          <code className="text-xs bg-base-300 px-1 py-0.5 rounded">.mp3</code>{" "}
          drop sounds by placing them in your PoE filter sounds folder.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            size="sm"
            onClick={handleScan}
            disabled={audioIsScanning || !audioEnabled}
            loading={audioIsScanning}
            className="gap-1.5"
          >
            {!audioIsScanning && <FiRefreshCw className="w-3.5 h-3.5" />}
            {detectedFileCount > 0 ? "Refresh sounds" : "Load sounds"}
          </Button>
          <Button
            size="sm"
            outline
            onClick={handleOpenFolder}
            disabled={!audioEnabled}
            className="gap-1.5"
          >
            <FiFolder className="w-3.5 h-3.5" />
            Find sounds
          </Button>
          {detectedFileCount > 0 && (
            <span className="text-xs text-base-content/40">
              {detectedFileCount} sound{detectedFileCount !== 1 ? "s" : ""}{" "}
              found
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
