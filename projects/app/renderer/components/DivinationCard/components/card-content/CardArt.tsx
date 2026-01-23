interface CardArtProps {
  artSrc: string;
  cardName: string;
}

// Dynamically import all card images
const cardImages = import.meta.glob<{ default: string }>(
  "~/renderer/assets/poe1/divination-card-images/*.png",
  { eager: true },
);

function getCardImage(artSrc: string): string {
  const key = `/renderer/assets/poe1/divination-card-images/${artSrc}`;
  return cardImages[key]?.default ?? "";
}

/**
 * Displays the card artwork in the upper white area
 */
export function CardArt({ artSrc, cardName }: CardArtProps) {
  return (
    <div className="absolute z-10 top-[39px] left-[22px] h-[204px] flex items-center justify-center overflow-hidden">
      <img
        src={getCardImage(artSrc)}
        alt={cardName}
        className="max-w-full max-h-full object-contain"
      />
    </div>
  );
}
