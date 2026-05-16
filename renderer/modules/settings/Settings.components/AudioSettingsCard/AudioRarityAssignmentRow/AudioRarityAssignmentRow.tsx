import type { ChangeEvent } from "react";
import { FiPlay, FiSquare, FiX } from "react-icons/fi";

import { Button } from "~/renderer/components";
import { trackEvent } from "~/renderer/modules/umami";
import { useSettingsShallow } from "~/renderer/store";
import { RARITY_LABELS } from "~/renderer/utils";

import {
  AUDIO_RARITY_SETTING_KEYS,
  assignAudioRaritySound,
  BUNDLED_RARITY_SOUNDS,
  playAudioPreview,
} from "../AudioSettingsCard.utils";

interface AudioRarityAssignmentRowProps {
  rarity: 1 | 2 | 3;
}

export function AudioRarityAssignmentRow({
  rarity,
}: AudioRarityAssignmentRowProps) {
  const {
    audioEnabled,
    audioDetectedFiles,
    audioPreviewingFile,
    audioVolume,
    currentPath,
    setAudioPreviewingFile,
    updateSetting,
  } = useSettingsShallow((settings) => ({
    audioEnabled: settings.audioEnabled,
    audioDetectedFiles: settings.audioDetectedFiles,
    audioPreviewingFile: settings.audioPreviewingFile,
    audioVolume: settings.audioVolume,
    currentPath: settings[AUDIO_RARITY_SETTING_KEYS[rarity - 1]],
    setAudioPreviewingFile: settings.setAudioPreviewingFile,
    updateSetting: settings.updateSetting,
  }));
  const previewSource = currentPath ?? BUNDLED_RARITY_SOUNDS[rarity];
  const isPreviewing = audioPreviewingFile === previewSource;

  const handleSoundChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const file = audioDetectedFiles.find(
      (candidate) => candidate.fullPath === event.target.value,
    );
    void assignAudioRaritySound({
      rarity,
      file: file ?? null,
      updateSetting,
    });
  };

  const handlePreview = () => {
    const isCustom = currentPath !== null;

    void playAudioPreview({
      source: previewSource,
      isCustom,
      audioVolume,
      audioPreviewingFile,
      setAudioPreviewingFile,
    });
    trackEvent("audio-preview-rarity", {
      rarity,
      type: isCustom ? "custom" : "default",
    });
  };

  const handleReset = () => {
    void assignAudioRaritySound({
      rarity,
      file: null,
      updateSetting,
    });
  };

  return (
    <div className="grid gap-2 md:grid-cols-[8rem_1fr] md:items-center">
      <span className="text-xs font-semibold text-base-content/70">
        {RARITY_LABELS[rarity]}
      </span>
      <div className="flex gap-2 items-center">
        <select
          className="select select-bordered select-sm flex-1"
          disabled={!audioEnabled}
          value={currentPath ?? ""}
          onChange={handleSoundChange}
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
          onClick={handlePreview}
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
            onClick={handleReset}
          >
            <FiX className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
