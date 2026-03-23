import { useCallback, useEffect, useMemo, useRef } from "react";
import { FiFolder, FiPlay, FiRefreshCw, FiSquare, FiX } from "react-icons/fi";

import type { CustomSoundFile } from "~/main/modules/settings-store/SettingsStore.dto";
import rarity1Sound from "~/renderer/assets/audio/rarity1.mp3";
import rarity2Sound from "~/renderer/assets/audio/rarity2.mp3";
import rarity3Sound from "~/renderer/assets/audio/rarity3.mp3";
import { Button } from "~/renderer/components";
import { trackEvent } from "~/renderer/modules/umami";
import { useBoundStore } from "~/renderer/store";
import { RARITY_LABELS } from "~/renderer/utils";

const RARITY_SETTING_KEYS = [
  "audioRarity1Path",
  "audioRarity2Path",
  "audioRarity3Path",
] as const;

const BUNDLED_SOUNDS: Record<number, string> = {
  1: rarity1Sound,
  2: rarity2Sound,
  3: rarity3Sound,
};

const AudioSettingsCard = () => {
  const {
    settings: {
      audioDetectedFiles,
      audioIsScanning,
      audioPreviewingFile,
      scanCustomSounds,
      setAudioPreviewingFile,
      updateSetting,
      audioEnabled,
      audioVolume,
      audioRarity1Path,
      audioRarity2Path,
      audioRarity3Path,
    },
  } = useBoundStore();

  const rarityPaths = useMemo<Record<number, string | null>>(
    () => ({
      1: audioRarity1Path,
      2: audioRarity2Path,
      3: audioRarity3Path,
    }),
    [audioRarity1Path, audioRarity2Path, audioRarity3Path],
  );

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleScan = useCallback(async () => {
    await scanCustomSounds();
    trackEvent("audio-scan-custom-sounds");
  }, [scanCustomSounds]);

  const handleOpenFolder = useCallback(async () => {
    await window.electron.settings.openCustomSoundsFolder();
    trackEvent("audio-open-sounds-folder");
  }, []);

  const handlePreview = useCallback(
    async (soundSource: string, isCustom: boolean) => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      if (audioPreviewingFile === soundSource) {
        setAudioPreviewingFile(null);
        return;
      }

      try {
        let audioSrc: string;

        if (isCustom) {
          const dataUrl =
            await window.electron.settings.getCustomSoundData(soundSource);
          if (!dataUrl) return;
          audioSrc = dataUrl;
        } else {
          audioSrc = soundSource;
        }

        const audio = new Audio(audioSrc);
        audio.volume = audioVolume;
        audio.onended = () => setAudioPreviewingFile(null);
        audioRef.current = audio;
        setAudioPreviewingFile(soundSource);
        await audio.play();
        trackEvent("audio-preview-sound", {
          type: isCustom ? "custom" : "default",
        });
      } catch (error) {
        console.error("Failed to preview sound:", error);
        setAudioPreviewingFile(null);
      }
    },
    [audioPreviewingFile, audioVolume, setAudioPreviewingFile],
  );

  const handlePreviewRarity = useCallback(
    (rarity: 1 | 2 | 3) => {
      const customPath = rarityPaths[rarity];

      if (customPath) {
        handlePreview(customPath, true);
      } else {
        handlePreview(BUNDLED_SOUNDS[rarity], false);
      }

      trackEvent("audio-preview-rarity", {
        rarity,
        type: customPath ? "custom" : "default",
      });
    },
    [rarityPaths, handlePreview],
  );

  const handleAssignSound = useCallback(
    async (rarity: 1 | 2 | 3, file: CustomSoundFile | null) => {
      const key = RARITY_SETTING_KEYS[rarity - 1];
      await updateSetting(key, file?.fullPath ?? null);
      trackEvent("audio-assign-sound", {
        rarity,
        type: file ? "custom" : "default",
      });
    },
    [updateSetting],
  );

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const volumePercent = Math.round(audioVolume * 100);

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">Audio</h2>
        <p className="text-sm text-base-content/60">
          Configure sounds for rare divination card drops during live sessions
        </p>

        <div className="space-y-4 mt-4">
          {/* Enable/Disable */}
          <div className="form-control">
            <label className="label cursor-pointer justify-start gap-4">
              <span className="label-text flex-1">Enable drop sounds</span>
              <input
                type="checkbox"
                className="toggle toggle-sm toggle-primary"
                checked={audioEnabled}
                onChange={(e) => {
                  updateSetting("audioEnabled", e.target.checked);
                  trackEvent("settings-change", {
                    setting: "audioEnabled",
                    value: e.target.checked,
                  });
                }}
              />
            </label>
          </div>

          {/* Volume Slider */}
          <div className="form-control">
            <div className="flex items-center gap-3">
              <span className="text-sm text-base-content/70 min-w-13">
                Volume
              </span>
              <input
                type="range"
                className="range range-primary range-xs flex-1 disabled:opacity-40"
                min={0}
                max={1}
                step={0.05}
                value={audioVolume}
                disabled={!audioEnabled}
                onChange={(e) => {
                  updateSetting("audioVolume", parseFloat(e.target.value));
                }}
              />
              <span className="text-sm font-mono text-base-content/70 min-w-9.5 text-right tabular-nums">
                {volumePercent}%
              </span>
            </div>
          </div>

          <div className="divider text-xs text-base-content/40">
            Custom Sounds
          </div>

          {/* Custom sounds folder — friendly description with inline actions */}
          <div className="rounded-lg bg-base-200/50 px-4 py-3 space-y-2">
            <p className="text-sm text-base-content/70">
              Use your own{" "}
              <code className="text-xs bg-base-300 px-1 py-0.5 rounded">
                .mp3
              </code>{" "}
              drop sounds by placing them in your PoE filter sounds folder.
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                size="sm"
                onClick={handleScan}
                disabled={audioIsScanning || !audioEnabled}
                loading={audioIsScanning}
                className="gap-1.5"
              >
                {!audioIsScanning && <FiRefreshCw className="w-3.5 h-3.5" />}
                {audioDetectedFiles.length > 0
                  ? "Refresh sounds"
                  : "Load sounds"}
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
              {audioDetectedFiles.length > 0 && (
                <span className="text-xs text-base-content/40 ml-auto">
                  {audioDetectedFiles.length} sound
                  {audioDetectedFiles.length !== 1 ? "s" : ""} found
                </span>
              )}
            </div>
          </div>

          <div className="divider my-0" />

          {/* Rarity assignments */}
          <div className="space-y-3">
            {([1, 2, 3] as const).map((rarity) => {
              const currentPath = rarityPaths[rarity];
              const previewSource = currentPath ?? BUNDLED_SOUNDS[rarity];
              const isPreviewing = audioPreviewingFile === previewSource;

              return (
                <div key={rarity} className="space-y-1">
                  <span className="text-xs font-semibold text-base-content/70">
                    {RARITY_LABELS[rarity]}
                  </span>
                  <div className="flex gap-2 items-center">
                    <select
                      className="select select-bordered select-sm flex-1"
                      disabled={!audioEnabled}
                      value={currentPath ?? ""}
                      onChange={(e) => {
                        const file = audioDetectedFiles.find(
                          (f) => f.fullPath === e.target.value,
                        );
                        handleAssignSound(rarity, file ?? null);
                      }}
                    >
                      <option value="">Default (bundled)</option>
                      {audioDetectedFiles.map((file) => (
                        <option key={file.fullPath} value={file.fullPath}>
                          {file.filename}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="ghost"
                      size="sm"
                      square
                      title="Preview"
                      disabled={!audioEnabled}
                      onClick={() => handlePreviewRarity(rarity)}
                    >
                      {isPreviewing ? (
                        <FiSquare className="w-4 h-4 text-primary" />
                      ) : (
                        <FiPlay className="w-4 h-4" />
                      )}
                    </Button>
                    {currentPath && (
                      <Button
                        variant="ghost"
                        size="sm"
                        square
                        title="Reset to default"
                        disabled={!audioEnabled}
                        onClick={() => handleAssignSound(rarity, null)}
                      >
                        <FiX className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioSettingsCard;
