import type { CardEffectProps } from "../types";

export function ExtremelyRareEffect({
  mousePos,
  isHovered,
  posX,
  posY,
}: CardEffectProps) {
  return (
    <>
      {/* Smooth color gradient (no stripes) */}
      <div
        className="absolute z-21 inset-0 rounded-[14.55px/10.5px] transition-opacity duration-300 pointer-events-none"
        style={{
          opacity: isHovered ? 0.1 : 0,
          clipPath: "inset(2.8% 4% round 2.55% / 1.5%)",
          backgroundImage: `
            linear-gradient(
              ${posY * 0.8}deg,
              rgb(255, 119, 115) 0%,
              rgba(255, 237, 95, 1) 16%,
              rgba(168, 255, 95, 1) 32%,
              rgba(131, 255, 247, 1) 48%,
              rgba(120, 148, 255, 1) 64%,
              rgb(216, 117, 255) 80%,
              rgb(255, 119, 115) 100%
            )
          `,
          backgroundRepeat: "no-repeat",
          backgroundSize: "500% 500%",
          backgroundPosition: `${(posX - 50) * -0.8 + 50}% ${(posY - 50) * -0.8 + 50}%`,
          mixBlendMode: "screen",
        }}
      />

      {/* Diagonal shimmer bars */}
      <div
        className="absolute z-22 inset-0 rounded-[14.55px/10.5px] transition-opacity duration-300 pointer-events-none"
        style={{
          opacity: isHovered ? 0.1 : 0,
          clipPath: "inset(2.8% 4% round 2.55% / 1.5%)",
          backgroundImage: `
            repeating-linear-gradient(
              133deg,
              #0e152e 0%,
              hsl(180, 10%, 60%) 3.8%,
              hsl(180, 29%, 66%) 4.5%,
              hsl(180, 10%, 60%) 5.2%,
              #0e152e 10%,
              #0e152e 12%
            )
          `,
          backgroundRepeat: "no-repeat",
          backgroundSize: "150% 150%",
          backgroundPosition: `${(posX - 50) * 0.6 + 50}% ${(posY - 50) * 0.6 + 50}%`,
          mixBlendMode: "hard-light",
          willChange: "opacity, background-position",
          transform: "translateZ(0)",
        }}
      />

      {/* Mirrored shimmer layer */}
      <div
        className="absolute z-23 inset-0 rounded-[14.55px/10.5px] transition-opacity duration-300 pointer-events-none"
        style={{
          opacity: isHovered ? 0.3 : 0,
          clipPath: "inset(2.8% 4% round 2.55% / 1.5%)",
          backgroundImage: `
            repeating-linear-gradient(
              133deg,
              #000 0%,
              hsl(180, 10%, 60%) 3.8%,
              hsl(180, 29%, 66%) 4.5%,
              hsl(180, 10%, 60%) 5.2%,
              #000 20%,
              #000 30%
            )
          `,
          backgroundRepeat: "no-repeat",
          backgroundSize: "150% 150%",
          backgroundPosition: `${(50 - posX) * 0.6 + 50}% ${(50 - posY) * 0.6 + 50}%`,
          mixBlendMode: "overlay",
          willChange: "opacity, background-position",
          transform: "translateZ(0)",
        }}
      />

      {/* Dark vignette for depth */}
      <div
        className="absolute z-24 inset-0 rounded-[14.55px/10.5px] transition-opacity duration-300 pointer-events-none"
        style={{
          opacity: isHovered ? 1 : 0,
          clipPath: "inset(2.8% 4% round 2.55% / 1.5%)",
          backgroundImage: `
            radial-gradient(
              farthest-corner circle at ${posX}% ${posY}%,
              rgba(0, 0, 0, 0.05) 12%,
              rgba(0, 0, 0, 0.1) 20%,
              rgba(0, 0, 0, 0.2) 120%
            )
          `,
          backgroundRepeat: "no-repeat",
          backgroundSize: "300% 300%",
          backgroundPosition: `${posX}% ${posY}%`,
          mixBlendMode: "multiply",
          willChange: "opacity, background-position",
          transform: "translateZ(0)",
        }}
      />

      {/* Subtle shadow depth layer */}
      <div
        className="absolute z-25 inset-0 rounded-[14.55px/10.5px] transition-opacity duration-300 pointer-events-none"
        style={{
          opacity: isHovered ? 0.3 : 0,
          clipPath: "inset(2.8% 4% round 2.55% / 1.5%)",
          backgroundImage: `
            radial-gradient(
              farthest-corner ellipse at ${posX * 0.3 + 35}% ${posY * 0.3 + 35}%,
              rgba(100, 100, 100, 0.3) 5%,
              rgba(50, 50, 50, 0.2) 15%,
              rgba(0, 0, 0, 0.4) 30%
            )
          `,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          backgroundSize: "600% 600%",
          mixBlendMode: "multiply",
        }}
      />

      {/* Bright highlight sweep */}
      <div
        className="absolute z-25 inset-0 rounded-[14.55px/10.5px] transition-opacity duration-200 pointer-events-none"
        style={{
          opacity: isHovered ? 1 : 0,
          clipPath: "inset(2.8% 4% round 2.55% / 1.5%)",
          backgroundImage: `
            radial-gradient(
              circle at ${posX}% ${posY}%,
              rgba(255, 255, 255, 0.5) 0%,
              rgba(255, 255, 255, 0.2) 20%,
              rgba(0, 0, 0, 0) 50%
            )
          `,
          backgroundRepeat: "no-repeat",
          mixBlendMode: "overlay",
          willChange: "opacity",
          transform: "translateZ(0)",
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
