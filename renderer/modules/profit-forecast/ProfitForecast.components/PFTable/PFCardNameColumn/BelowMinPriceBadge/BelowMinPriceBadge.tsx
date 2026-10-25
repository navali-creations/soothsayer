import { FiEyeOff } from "react-icons/fi";

import Tooltip from "~/renderer/components/Tooltip/Tooltip";

const BelowMinPriceBadge = () => (
  <Tooltip
    className="inline-flex items-center gap-0.5 shrink-0 rounded px-1 py-0.5 text-[10px] leading-none font-medium bg-base-content/10 text-base-content/50"
    content="This card is hidden by the min price filter"
  >
    <FiEyeOff className="w-2.5 h-2.5" />
    <span>filtered</span>
  </Tooltip>
);

export default BelowMinPriceBadge;
