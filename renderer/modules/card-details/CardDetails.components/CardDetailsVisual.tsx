import DivinationCard from "~/renderer/components/DivinationCard/DivinationCard";
import type { CardEntry } from "~/types/data-stores";

interface CardDetailsVisualProps {
  card: CardEntry;
}

const CardDetailsVisual = ({ card }: CardDetailsVisualProps) => {
  return (
    <div className="flex justify-center">
      <div className="scale-70 origin-top -mb-36">
        <DivinationCard card={card} />
      </div>
    </div>
  );
};

export default CardDetailsVisual;
