import type { CardEntry } from "../../../types/data-stores";
import { useState, useRef, useEffect, useMemo } from "react";

interface DivinationCardProps {
  card: CardEntry;
}

// Helper function to get color for a class name
function getColorForClass(className: string): string {
  switch (className) {
    case "-currency":
      return "rgb(170,158,130)";
    case "-unique":
      return "rgb(175,96,37)";
    case "-corrupted":
      return "rgb(210,0,0)";
    case "-white":
      return "rgb(200,200,200)";
    case "-magic":
      return "rgb(136,136,255)";
    case "-default":
      return "rgb(127,127,127)";
    case "-rare":
      return "rgb(255,255,119)";
    case "-gem":
      return "rgb(27,162,155)";
    case "-enchanted":
      return "rgb(184,218,242)";
    case "-divination":
      return "rgb(14,186,255)";
    case "-augmented":
      return "rgb(136,136,255)";
    case "-normal":
      return "rgb(200,200,200)";
    default:
      return "rgb(200,200,200)"; // Default white color
  }
}

// Process rewardHtml to inject inline styles for classes
function processRewardHtml(html: string): string {
  if (!html) return html;

  // Match all class attributes and replace them with inline styles
  return html.replace(/class="([^"]+)"/g, (match, classes) => {
    const classList = classes.split(" ");
    const colors = classList
      .filter((cls: string) => cls.startsWith("-"))
      .map((cls: string) => getColorForClass(cls));

    // Use the first color found, or default
    const color = colors[0] || "rgb(200,200,200)";
    return `style="color: ${color}"`;
  });
}

function DivinationCard({ card }: DivinationCardProps) {
  if (!card.divinationCard) {
    return null; // No metadata available
  }

  const { count } = card;
  const { artSrc, stackSize, rewardHtml, flavourHtml, rarity } =
    card.divinationCard;

  const processedRewardHtml = useMemo(
    () => processRewardHtml(rewardHtml),
    [rewardHtml],
  );

  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);

  useEffect(() => {
    const cardElement = cardRef.current;
    if (!cardElement) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = cardElement.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setMousePos({ x, y });

      // Calculate 3D rotation (hover-3d effect)
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const rotX = ((e.clientY - centerY) / rect.height) * -15; // Max 15deg rotation
      const rotY = ((e.clientX - centerX) / rect.width) * 15;
      setRotateX(rotX);
      setRotateY(rotY);
    };

    const handleMouseEnter = () => {
      setIsHovered(true);
    };

    const handleMouseLeave = () => {
      setMousePos({ x: 50, y: 50 }); // Reset to center
      setIsHovered(false);
      setRotateX(0);
      setRotateY(0);
    };

    cardElement.addEventListener("mousemove", handleMouseMove);
    cardElement.addEventListener("mouseenter", handleMouseEnter);
    cardElement.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      cardElement.removeEventListener("mousemove", handleMouseMove);
      cardElement.removeEventListener("mouseenter", handleMouseEnter);
      cardElement.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [rarity]);

  const barwidth = 0.5;
  const space = 500;
  const posX = mousePos.x;
  const posY = mousePos.y;

  return (
    <div
      ref={cardRef}
      className="relative w-[320px] h-[476px] transition-transform duration-200 ease-out"
      style={{
        // transform: `perspective(1000px) rotateX(${isHovered ? rotateX : 0}deg) rotateY(${isHovered ? rotateY : 0}deg)`,
        transformStyle: "preserve-3d",
        willChange: "transform",
      }}
    >
      {/* Card Frame Background */}
      <img
        src="./src/assets/poe1/Divination_card_frame.png"
        alt="Card Frame"
        className="absolute z-20 inset-0 w-[320px] h-full pointer-events-none"
      />

      {/* Pokemon V / Ultra Rare Holo Effect - Rarity 1 */}
      {rarity === 1 && (
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
        </>
      )}

      {/* Radiant Holofoil Effect - Rarity 2 (Toned down) */}
      {rarity === 2 && (
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
        </>
      )}

      {/* Holographic Shine Layer - Rarity 3 / 4 (less common & common) */}
      {(rarity === 3 || rarity === 4) && (
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
      )}

      {/* Card Art - positioned in the upper white area */}
      <div className="absolute z-10 top-[39px] left-[22px] h-[204px] flex items-center justify-center overflow-hidden">
        <img
          src={`./src/assets/poe1/divination-card-images/${artSrc}`}
          alt={card.name}
          className="max-w-full max-h-full object-contain"
        />
      </div>

      {/* Card Name - positioned in the ribbon (left decorative element) */}
      <div className="absolute z-30 top-[10px] flex justify-center w-full">
        <span className="text-gray-900 font-fontin text-[20px] max-w-[215px]">
          {card.name}
        </span>
      </div>

      {/* Stack Size - positioned in the small rectangle (right side) */}
      <div className="absolute z-30 top-[218px] left-[31px] w-[52px] h-[30px] flex items-center justify-center">
        <span className="text-white font-fontin text-[19px]">
          {count}/{stackSize}
        </span>
      </div>

      {/* Reward and Flavour - positioned in the bottom dark area */}
      <div className="absolute z-30 bottom-[25px] top-[265px] left-[30px] right-[30px] flex flex-col justify-center text-lg">
        <div className="flex flex-col items-center gap-3 h-full justify-evenly">
          {/* Reward */}
          <div className="text-center text-white leading-tight">
            <div
              className="font-fontin poe-card-text"
              dangerouslySetInnerHTML={{ __html: processedRewardHtml }}
            />
          </div>

          {/* Divider line (if there's flavour text) */}
          {flavourHtml && (
            <div className="flex justify-center w-full">
              <img
                src="./src/assets/poe1/Divination_card_separator.png"
                alt=""
                className="h-[2px]"
              />
            </div>
          )}

          {/* Flavour Text */}
          {flavourHtml && (
            <div className="font-fontin text-center text-[rgb(175,96,37)] italic text-[17px] leading-tight">
              <div
                className="poe-card-text"
                dangerouslySetInnerHTML={{ __html: flavourHtml }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DivinationCard;
