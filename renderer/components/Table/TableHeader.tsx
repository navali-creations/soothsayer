import type { ReactNode } from "react";

import Flex from "../Flex/Flex";
import Tooltip from "../Tooltip/Tooltip";

type TableHeaderProps = {
  children: ReactNode;
  tooltip?: string;
  className?: string;
};

const TableHeader = ({ children, tooltip, className }: TableHeaderProps) => {
  if (tooltip) {
    return (
      <Tooltip as="div" className={className} content={tooltip}>
        <Flex className="gap-1 items-center border-b border-dotted">
          {children} <sup>?</sup>
        </Flex>
      </Tooltip>
    );
  }

  return <div className="border-b-transparent">{children}</div>;
};

export default TableHeader;
