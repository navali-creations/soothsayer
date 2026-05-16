import { AudioRarityAssignmentRow } from "../AudioRarityAssignmentRow/AudioRarityAssignmentRow";
import { AUDIO_RARITIES } from "../AudioSettingsCard.utils";

export function AudioRarityAssignments() {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-base-content/60">
        Per-rarity sound
      </h3>
      {AUDIO_RARITIES.map((rarity) => (
        <AudioRarityAssignmentRow key={rarity} rarity={rarity} />
      ))}
    </div>
  );
}
