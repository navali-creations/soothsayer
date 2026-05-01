import clsx from "clsx";

import { LegendIcon, type LegendVisual } from "../LegendIcon";

export interface ChartLegendItem {
  id: string;
  label: string;
  visual: LegendVisual;
  color: string;
  hidden?: boolean;
  onClick?: () => void;
}

interface ChartLegendProps {
  items: readonly ChartLegendItem[];
  className?: string;
}

export function ChartLegend({ items, className }: ChartLegendProps) {
  return (
    <div className={clsx("flex items-center gap-3", className)}>
      {items.map((item) => {
        const commonClassName = clsx(
          "flex items-center gap-1.5 text-[11px] transition-opacity",
          item.hidden ? "opacity-30" : "opacity-100",
        );

        if (item.onClick) {
          return (
            <button
              key={item.id}
              type="button"
              className={clsx(commonClassName, "cursor-pointer")}
              onClick={item.onClick}
            >
              <LegendIcon
                visual={item.visual}
                color={item.hidden ? "rgba(255, 255, 255, 0.3)" : item.color}
              />
              <span className="text-base-content/60">{item.label}</span>
            </button>
          );
        }

        return (
          <div key={item.id} className={commonClassName}>
            <LegendIcon visual={item.visual} color={item.color} />
            <span className="text-base-content/60">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}
