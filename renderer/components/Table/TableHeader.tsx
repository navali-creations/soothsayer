import clsx from "clsx";
import type { ReactNode } from "react";

import Flex from "../Flex/Flex";

type TableHeaderProps = {
  children: ReactNode;
  tooltip?: string;
  className?: string;
};

const TableHeader = ({ children, tooltip, className }: TableHeaderProps) => {
  if (tooltip) {
    return (
      <div
        className={clsx("tooltip tooltip-right tooltip-primary", className)}
        data-tip={tooltip}
      >
        <Flex className="gap-1 items-center border-b border-dotted">
          {children} <sup>?</sup>
        </Flex>
      </div>
    );
  }

  return <div className="border-b-transparent">{children}</div>;
};

export default TableHeader;
