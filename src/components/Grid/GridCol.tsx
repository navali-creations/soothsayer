import type { ReactNode } from "react";
import { cn } from "../../utils";

interface GridColProps {
  children?: ReactNode;
  className?: string;
}

/**
 * GridCol component - a simple li wrapper for grid items
 *
 * Apply Tailwind grid column utilities directly via className:
 * - col-span-{n}, col-start-{n}, col-end-{n}
 */
const GridCol = ({ children, className }: GridColProps) => {
  return <li className={cn(className)}>{children}</li>;
};

export default GridCol;
