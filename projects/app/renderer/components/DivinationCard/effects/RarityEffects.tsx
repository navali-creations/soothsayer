import type { CardEffectProps } from "../types";
import { ExtremelyRareEffect } from "./ExtremelyRareEffect";
import { RareEffect } from "./RareEffect";
import { CommonEffect } from "./CommonEffect";

interface RarityEffectsProps extends CardEffectProps {
  rarity: number;
}

/**
 * Routes to the appropriate rarity effect component based on rarity level
 */
export function RarityEffects({ rarity, ...effectProps }: RarityEffectsProps) {
  if (rarity === 1) {
    return <ExtremelyRareEffect {...effectProps} />;
  }

  if (rarity === 2) {
    return <RareEffect {...effectProps} />;
  }

  return <CommonEffect {...effectProps} />;
}
