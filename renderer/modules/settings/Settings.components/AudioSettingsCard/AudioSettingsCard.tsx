import { useEffect } from "react";

import { AudioRarityAssignments } from "./AudioRarityAssignments/AudioRarityAssignments";
import { AudioSettingsBasicControls } from "./AudioSettingsBasicControls/AudioSettingsBasicControls";
import { stopAudioPreview } from "./AudioSettingsCard.utils";

const AudioSettingsCard = () => {
  useEffect(() => {
    return stopAudioPreview;
  }, []);

  return (
    <section className="space-y-3">
      <div className="grid gap-8 lg:grid-cols-[minmax(16rem,0.75fr)_minmax(22rem,1fr)]">
        <AudioSettingsBasicControls />

        <AudioRarityAssignments />
      </div>
    </section>
  );
};

export default AudioSettingsCard;
