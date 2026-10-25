import { MdBlock } from "react-icons/md";

import Tooltip from "~/renderer/components/Tooltip/Tooltip";

interface DisabledIndicatorProps {
  isDisabled: boolean;
}

export const DisabledIndicator = ({ isDisabled }: DisabledIndicatorProps) => {
  if (!isDisabled) {
    return null;
  }

  return (
    <Tooltip
      as="div"
      className="absolute -top-5 -left-5 z-100 bg-base-300 rounded-full p-3"
      content="This card is drop-disabled and cannot currently be obtained"
    >
      <MdBlock className="w-8 h-8 text-error/70" />
    </Tooltip>
  );
};
