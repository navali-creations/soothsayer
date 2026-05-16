import type { CustomSoundFile } from "~/main/modules/settings-store/SettingsStore.dto";
import rarity1Sound from "~/renderer/assets/audio/rarity1.mp3";
import rarity2Sound from "~/renderer/assets/audio/rarity2.mp3";
import rarity3Sound from "~/renderer/assets/audio/rarity3.mp3";
import { trackEvent } from "~/renderer/modules/umami";

export const AUDIO_RARITIES = [1, 2, 3] as const;

export const AUDIO_RARITY_SETTING_KEYS = [
  "audioRarity1Path",
  "audioRarity2Path",
  "audioRarity3Path",
] as const;

export const BUNDLED_RARITY_SOUNDS: Record<number, string> = {
  1: rarity1Sound,
  2: rarity2Sound,
  3: rarity3Sound,
};

let activePreviewAudio: HTMLAudioElement | null = null;

interface PlayAudioPreviewInput {
  source: string;
  isCustom: boolean;
  audioVolume: number;
  audioPreviewingFile: string | null;
  setAudioPreviewingFile: (file: string | null) => void;
}

export function stopAudioPreview() {
  if (!activePreviewAudio) return;

  activePreviewAudio.pause();
  activePreviewAudio = null;
}

export async function playAudioPreview({
  source,
  isCustom,
  audioVolume,
  audioPreviewingFile,
  setAudioPreviewingFile,
}: PlayAudioPreviewInput) {
  stopAudioPreview();

  if (audioPreviewingFile === source) {
    setAudioPreviewingFile(null);
    return;
  }

  try {
    let audioSrc: string;

    if (isCustom) {
      const dataUrl = await window.electron.settings.getCustomSoundData(source);
      if (!dataUrl) return;
      audioSrc = dataUrl;
    } else {
      audioSrc = source;
    }

    const audio = new Audio(audioSrc);
    audio.volume = audioVolume;
    audio.onended = () => setAudioPreviewingFile(null);
    activePreviewAudio = audio;
    setAudioPreviewingFile(source);
    await audio.play();
    trackEvent("audio-preview-sound", {
      type: isCustom ? "custom" : "default",
    });
  } catch (error) {
    console.error("Failed to preview sound:", error);
    setAudioPreviewingFile(null);
  }
}

export async function assignAudioRaritySound({
  rarity,
  file,
  updateSetting,
}: {
  rarity: 1 | 2 | 3;
  file: CustomSoundFile | null;
  updateSetting: (
    key: (typeof AUDIO_RARITY_SETTING_KEYS)[number],
    value: string | null,
  ) => Promise<void>;
}) {
  const key = AUDIO_RARITY_SETTING_KEYS[rarity - 1];
  await updateSetting(key, file?.fullPath ?? null);
  trackEvent("audio-assign-sound", {
    rarity,
    type: file ? "custom" : "default",
  });
}
