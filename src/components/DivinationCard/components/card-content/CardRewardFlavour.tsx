interface CardRewardFlavourProps {
  processedRewardHtml: string;
  flavourHtml: string;
}

/**
 * Displays the reward and flavour text in the bottom dark area
 */
export function CardRewardFlavour({
  processedRewardHtml,
  flavourHtml,
}: CardRewardFlavourProps) {
  return (
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
              className="h-0.5"
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
  );
}
