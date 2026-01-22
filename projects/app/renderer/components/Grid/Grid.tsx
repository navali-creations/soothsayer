import type { ReactNode } from "react";
import { cn } from "../../utils";
import GridCol from "./GridCol";

interface GridProps {
  children?: ReactNode;
  className?: string;
}

/**
 * Grid component - a simple wrapper around Tailwind's grid utilities
 *
 * Use with Grid.Col or apply grid utilities directly:
 * - grid-cols-{n} for column count
 * - gap-{size} for spacing
 * - Auto-flow, justify, align, etc.
 */
const Grid = ({ children, className }: GridProps) => {
  return <ul className={cn("grid gap-4", className)}>{children}</ul>;
};

Grid.Col = GridCol;

export default Grid;
