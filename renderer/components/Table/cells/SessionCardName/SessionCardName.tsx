import clsx from "clsx";
import { useId } from "react";

import CardNameLink from "~/renderer/components/CardNameLink/CardNameLink";
import DivinationCard from "~/renderer/components/DivinationCard/DivinationCard";
import { usePopover } from "~/renderer/hooks/usePopover/usePopover";
import type { CardEntry } from "~/types/data-stores";

interface SessionCardNameProps {
  card: Pick<CardEntry, "name" | "count" | "divinationCard">;
  hidden: boolean;
}

const SessionCardName = ({ card, hidden }: SessionCardNameProps) => {
  const popoverId = useId();
  const hasCardData = !!card.divinationCard;
  const { triggerRef, popoverRef } = usePopover({
    placement: "right",
    offset: 12,
    scale: 0.75,
  });

  return (
    <>
      <span
        ref={hasCardData ? triggerRef : null}
        className={clsx({
          "cursor-help": hasCardData,
          "opacity-40 line-through": hidden,
        })}
      >
        <CardNameLink
          cardName={card.name}
          className={clsx({ "opacity-40 line-through": hidden }) || undefined}
        />
        {hidden && (
          <span className="badge badge-error badge-xs ml-2">Hidden</span>
        )}
      </span>
      {hasCardData && (
        <div
          id={popoverId}
          ref={popoverRef}
          popover="manual"
          className="p-0 border-0 bg-transparent"
        >
          <DivinationCard card={card} />
        </div>
      )}
    </>
  );
};

export default SessionCardName;
