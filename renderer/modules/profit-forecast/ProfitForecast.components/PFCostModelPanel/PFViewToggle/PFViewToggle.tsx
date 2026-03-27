import clsx from "clsx";
import { FiBarChart2, FiTable } from "react-icons/fi";

import { useBoundStore } from "~/renderer/store";

import type { ForecastView } from "../../../ProfitForecast.slice/ProfitForecast.slice";

const VIEW_OPTIONS: {
  value: ForecastView;
  label: string;
  icon: typeof FiBarChart2;
}[] = [
  { value: "table", label: "Table", icon: FiTable },
  { value: "chart", label: "Chart", icon: FiBarChart2 },
];

const PFViewToggle = () => {
  const {
    profitForecast: { forecastView, setForecastView },
  } = useBoundStore();

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-base-content/50 font-medium">View</span>
      <div className="flex gap-1.5">
        {VIEW_OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            className={clsx(
              "badge badge-sm cursor-pointer select-none transition-colors gap-1",
              forecastView === value
                ? "badge-info"
                : "badge-ghost hover:badge-outline",
            )}
            onClick={() => {
              if (forecastView !== value) {
                setForecastView(value);
              }
            }}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PFViewToggle;
