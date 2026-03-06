import type { RelatedCardDTO } from "~/main/modules/card-details/CardDetails.dto";

import RelatedCardChip from "./RelatedCardChip";

// ─── Section Component ─────────────────────────────────────────────────────

interface RelatedCardsSectionProps {
  title: string;
  icon: React.ReactNode;
  cards: RelatedCardDTO[];
}

function RelatedCardsSection({ title, icon, cards }: RelatedCardsSectionProps) {
  if (cards.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase text-base-content/50 flex items-center gap-1.5">
        {icon}
        {title}
      </h4>
      <div className="flex flex-col gap-2">
        {cards.map((card) => (
          <RelatedCardChip key={card.name} card={card} />
        ))}
      </div>
    </div>
  );
}

export default RelatedCardsSection;
