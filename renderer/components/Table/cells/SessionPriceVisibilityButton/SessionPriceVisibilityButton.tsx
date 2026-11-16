import { FiEye, FiEyeOff } from "react-icons/fi";

import Tooltip from "~/renderer/components/Tooltip/Tooltip";
import { useBoundStore } from "~/renderer/store";

import type { SessionTableKind } from "../../Table.utils";

interface SessionPriceVisibilityButtonProps {
  kind: SessionTableKind;
  cardName: string;
  hidden: boolean;
  hasPrice?: boolean;
}

const SessionPriceVisibilityButton = ({
  kind,
  cardName,
  hidden,
  hasPrice = true,
}: SessionPriceVisibilityButtonProps) => {
  const toggle = useBoundStore((state) =>
    kind === "current"
      ? state.currentSession.toggleCardPriceVisibility
      : state.sessionDetails.toggleCardPriceVisibility,
  );
  const hasSnapshot = useBoundStore(
    (state) =>
      kind === "details" || !!state.currentSession.getSession()?.priceSnapshot,
  );
  const tooltip = !hasSnapshot
    ? "Price visibility can only be changed when using snapshot prices"
    : hidden
      ? "Click to include in totals"
      : "Click to exclude from totals";
  const handleToggle = () => void toggle(cardName);
  const isLoading = useBoundStore(
    (state) => kind === "current" && state.currentSession.isLoading,
  );

  return (
    <Tooltip as="div" content={tooltip} describeChild>
      <button
        type="button"
        aria-label={tooltip}
        className="btn btn-ghost btn-xs btn-square"
        onClick={handleToggle}
        disabled={!hasSnapshot || !hasPrice || isLoading}
      >
        {hidden ? (
          <FiEyeOff className="text-error" />
        ) : (
          <FiEye className="text-success" />
        )}
      </button>
    </Tooltip>
  );
};

export default SessionPriceVisibilityButton;
