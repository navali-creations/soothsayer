import cardFrame from "~/renderer/assets/poe1/Divination_card_frame.png";

/**
 * Card frame background image
 */
export function CardFrame() {
  return (
    <img
      src={cardFrame}
      alt="Card Frame"
      className="absolute z-20 inset-0 w-[320px] h-full pointer-events-none"
    />
  );
}
