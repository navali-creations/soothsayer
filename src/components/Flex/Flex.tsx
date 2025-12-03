import type { ReactNode } from "react";

interface FlexProps {
  children?: ReactNode;
  className?: string;
}

const Flex = ({ children, className = "" }: FlexProps) => {
  const classes = className ? `flex ${className}` : "flex";

  return <div className={classes}>{children}</div>;
};

export default Flex;
