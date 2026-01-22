import type { CardEntry } from "../../../../types/data-stores";

export interface DivinationCardProps {
  card: CardEntry;
}

export interface MousePosition {
  x: number;
  y: number;
}

export interface CardEffectProps {
  mousePos: MousePosition;
  isHovered: boolean;
  posX: number;
  posY: number;
}
