import { CARD_EFFECTS } from "../constants";
import type { CardEffectProps } from "../types";

export function RareEffect({
  mousePos,
  isHovered,
  posX,
  posY,
}: CardEffectProps) {
  const barwidth = CARD_EFFECTS.BAR_WIDTH;
  const space = CARD_EFFECTS.SPACE;

  return (
    <>
      {/* Rainbow gradient base */}
      <div
        className="absolute z-21 inset-0 rounded-[14.55px/10.5px] transition-opacity duration-300 pointer-events-none"
        style={{
          opacity: isHovered ? 0.15 : 0,
          clipPath: "inset(2.8% 4% round 2.55% / 1.5%)",
          backgroundImage: `
            repeating-linear-gradient(
              55deg,
              rgb(255, 161, 158) ${space * 1}px,
              rgb(85, 178, 255) ${space * 2}px,
              rgb(255, 199, 146) ${space * 3}px,
              rgb(253, 170, 240) ${space * 5}px,
              rgb(148, 241, 255) ${space * 6}px,
              rgb(255, 161, 158) ${space * 7}px
            )
          `,
          backgroundRepeat: "no-repeat",
          backgroundSize: "800% 800%",
          backgroundPosition: `
            ${(posX - 50) * -0.5 + 50}% ${(posY - 50) * -0.5 + 50}%
          `,
          mixBlendMode: "color-dodge",
        }}
      />

      {/* First diagonal criss-cross (45deg) */}
      <div
        className="absolute z-22 inset-0 rounded-[14.55px/10.5px] transition-opacity duration-300 pointer-events-none"
        style={{
          opacity: isHovered ? 0.05 : 0,
          clipPath: "inset(2.8% 4% round 2.55% / 1.5%)",
          backgroundImage: `
            repeating-linear-gradient(
              45deg,
              transparent 0%,
              transparent ${barwidth * 4}%,
              rgba(255, 255, 255, 0.8) ${barwidth * 4}%,
              rgba(255, 255, 255, 1) ${barwidth * 5}%,
              rgba(255, 255, 255, 0.8) ${barwidth * 6}%,
              transparent ${barwidth * 6}%,
              transparent ${barwidth * 10}%
            )
          `,
          backgroundRepeat: "no-repeat",
          backgroundSize: "400% 400%",
          backgroundPosition: `
            ${(posX - 50) * 0.3 + 50}% ${(posY - 50) * 0.3 + 50}%
          `,
          mixBlendMode: "overlay",
        }}
      />

      {/* Second diagonal criss-cross (-45deg) */}
      <div
        className="absolute z-23 inset-0 rounded-[14.55px/10.5px] transition-opacity duration-300 pointer-events-none"
        style={{
          opacity: isHovered ? 0.05 : 0,
          clipPath: "inset(2.8% 4% round 2.55% / 1.5%)",
          backgroundImage: `
            repeating-linear-gradient(
              -45deg,
              transparent 0%,
              transparent ${barwidth * 4}%,
              rgba(255, 255, 255, 0.8) ${barwidth * 4}%,
              rgba(255, 255, 255, 1) ${barwidth * 5}%,
              rgba(255, 255, 255, 0.8) ${barwidth * 6}%,
              transparent ${barwidth * 6}%,
              transparent ${barwidth * 10}%
            )
          `,
          backgroundRepeat: "no-repeat",
          backgroundSize: "400% 400%",
          backgroundPosition: `
            ${(posX - 50) * 0.3 + 50}% ${(posY - 50) * 0.3 + 50}%
          `,
          mixBlendMode: "overlay",
        }}
      />

      {/* Radial glow/flash that follows cursor */}
      <div
        className="absolute z-24 inset-0 rounded-[14.55px/10.5px] transition-opacity duration-300 pointer-events-none"
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
    </>
  );
}
