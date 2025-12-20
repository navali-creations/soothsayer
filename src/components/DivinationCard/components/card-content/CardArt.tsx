interface CardArtProps {
  artSrc: string;
  cardName: string;
}

/**
 * Displays the card artwork in the upper white area
 */
export function CardArt({ artSrc, cardName }: CardArtProps) {
  return (
    <div className="absolute z-10 top-[39px] left-[22px] h-[204px] flex items-center justify-center overflow-hidden">
      <img
        src={`./src/assets/poe1/divination-card-images/${artSrc}`}
        alt={cardName}
        className="max-w-full max-h-full object-contain"
      />
    </div>
  );
}
