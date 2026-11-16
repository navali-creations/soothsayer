import { FiEye } from "react-icons/fi";

import Tooltip from "~/renderer/components/Tooltip/Tooltip";

const SessionPriceVisibilityHeader = () => {
  return (
    <Tooltip
      as="div"
      content="Toggle price visibility (affects totals)"
      className="inline-flex size-6 items-center justify-center"
    >
      <FiEye className="opacity-50" />
    </Tooltip>
  );
};

export default SessionPriceVisibilityHeader;
