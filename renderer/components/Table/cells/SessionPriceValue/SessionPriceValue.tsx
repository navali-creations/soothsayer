import clsx from "clsx";

import { useBoundStore } from "~/renderer/store";
import { formatCurrency } from "~/renderer/utils";

import type { SessionTableKind } from "../../Table.utils";

interface SessionPriceValueProps {
  kind: SessionTableKind;
  value: number;
  hidden?: boolean;
  total?: boolean;
}

const SessionPriceValue = ({
  kind,
  value,
  hidden = false,
  total = false,
}: SessionPriceValueProps) => {
  const ratio = useBoundStore((state) =>
    kind === "current"
      ? state.currentSession.getChaosToDivineRatio()
      : state.sessionDetails.getPriceData().chaosToDivineRatio,
  );
  return (
    <span
      className={clsx("tabular-nums", {
        "font-semibold": total,
        "opacity-40": hidden,
        "text-success": total && !hidden,
        "text-base-content/30": value === 0,
      })}
    >
      {value === 0 ? "—" : formatCurrency(value, ratio)}
    </span>
  );
};

export default SessionPriceValue;
