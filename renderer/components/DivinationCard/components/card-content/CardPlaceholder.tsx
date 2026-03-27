import { FiImage } from "react-icons/fi";

interface CardPlaceholderProps {
  cardName: string;
}

/**
 * Placeholder content rendered inside the card frame when `divinationCard`
 * metadata is not yet available (e.g. league-start before images are scraped).
 *
 * Occupies the same absolute-positioned regions as the real card-content
 * components (CardArt, CardName, CardRewardFlavour) so the card frame
 * dimensions stay consistent.
 */
export function CardPlaceholder({ cardName }: CardPlaceholderProps) {
  return (
    <>
      {/* Card name — same position as CardName */}
      <div
        className="absolute z-30 top-2.5 flex justify-center w-full"
        data-testid="card-placeholder-name"
      >
        <span className="text-gray-900 font-fontin text-[20px] max-w-[215px] text-center">
          {cardName}
        </span>
      </div>

      {/* Art area — placeholder message instead of artwork */}
      <div
        className="absolute z-10 top-[39px] left-[22px] right-[22px] h-[204px] flex flex-col items-center justify-center gap-2"
        data-testid="card-placeholder"
      >
        <FiImage className="w-10 h-10 text-gray-500/60" />
        <span className="text-gray-500/80 text-xs text-center font-fontin leading-tight px-2">
          Card data not
          <br />
          available yet
        </span>
      </div>

      {/* Bottom area — subtle hint instead of reward/flavour text */}
      <div
        className="absolute z-30 bottom-[25px] top-[265px] left-[30px] right-[30px] flex flex-col items-center justify-center"
        data-testid="card-placeholder-hint"
      >
        <span className="text-gray-600/50 text-[13px] font-fontin italic text-center">
          Stats may still be available below
        </span>
      </div>
    </>
  );
}
