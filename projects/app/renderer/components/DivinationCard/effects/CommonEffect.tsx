import type { CardEffectProps } from "../types";

export function CommonEffect({ mousePos, isHovered }: CardEffectProps) {
  return (
    <div
      className="absolute z-15 inset-0 rounded-[14.55px/10.5px] transition-opacity duration-300 pointer-events-none"
      style={{
        opacity: isHovered ? 1.0 : 0,
        background: `radial-gradient(
          circle at ${mousePos.x}% ${mousePos.y}%,
          rgba(255, 255, 255, 0.3) 0%,
          rgba(255, 255, 255, 0.1) 20%,
          rgba(0, 0, 0, 0) 50%
        )`,
        mixBlendMode: "overlay",
      }}
    />
  );
}
