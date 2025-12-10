import type { ReactNode } from "react";
import Flex from "../Flex/Flex";

type TableHeaderProps = {
  children: ReactNode;
  tooltip?: string;
};

const TableHeader = ({ children, tooltip }: TableHeaderProps) => {
  if (tooltip) {
    return (
      <div className="tooltip tooltip-right tooltip-primary" data-tip={tooltip}>
        <Flex className="gap-1 items-center border-b border-dotted">
          {children} <sup>?</sup>
        </Flex>
      </div>
    );
  }

  return <div className="border-b-transparent">{children}</div>;
};

export default TableHeader;
