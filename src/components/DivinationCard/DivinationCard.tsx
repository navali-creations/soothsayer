import type { CardEntry } from "../../../types/data-stores";

interface DivinationCardProps {
  card: CardEntry;
}

function DivinationCard({ card }: DivinationCardProps) {
  if (!card.divinationCard) {
    return null; // No metadata available
  }

  const { count } = card;
  const { artSrc, stackSize, rewardHtml, flavourHtml } = card.divinationCard;

  return (
    <div className="relative w-[320px] h-[476px]">
      {/* Card Frame Background */}
      <img
        src="./src/assets/poe1/Divination_card_frame.png"
        alt="Card Frame"
        className="absolute z-20 inset-0 w-[320px] h-full pointer-events-none"
      />

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
        <span className="text-gray-900 font-fontin text-[20px] max-w-[200px]">
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
      <div className="absolute z-30 bottom-[25px] top-[265px] left-[30px] right-[30px] flex flex-col justify-center">
        <div className="flex flex-col items-center gap-3">
          {/* Reward */}
          <div className="text-center text-white text-[14px] leading-tight">
            <div
              className="poe-card-text"
              dangerouslySetInnerHTML={{ __html: rewardHtml }}
            />
          </div>

          {/* Divider line (if there's flavour text) */}
          {flavourHtml && <div className="w-full border-t border-white/30" />}

          {/* Flavour Text */}
          {flavourHtml && (
            <div className="text-center text-amber-500 italic text-[13px] leading-relaxed">
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
