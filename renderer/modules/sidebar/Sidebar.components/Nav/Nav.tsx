import { FiActivity, FiBarChart2, FiCpu, FiTrendingUp } from "react-icons/fi";
import { GiCardRandom } from "react-icons/gi";
import { MdCompareArrows } from "react-icons/md";

import { Link } from "~/renderer/components";
import { formatTickingTimer, useTickingTimer } from "~/renderer/hooks";
import { useAppPerformanceShallow, useSettings } from "~/renderer/store";

import { SidebarPerformanceMiniCharts } from "../SidebarPerformanceMiniCharts/SidebarPerformanceMiniCharts";

export function Nav() {
  const { appPerformanceMonitorEnabled } = useSettings();
  const { captureStartedAt, isSampling, samples } = useAppPerformanceShallow(
    (appPerformance) => ({
      captureStartedAt: appPerformance.captureStartedAt,
      isSampling: appPerformance.isSampling,
      samples: appPerformance.samples,
    }),
  );
  const captureTimer = useTickingTimer({
    referenceTime: captureStartedAt,
    direction: "up",
    enabled: appPerformanceMonitorEnabled && isSampling,
  });
  const appPerformanceLabel = isSampling ? "App Perf..." : "App Performance";
  const showAppPerformanceNav = appPerformanceMonitorEnabled;
  const showSidebarPerformanceCharts =
    appPerformanceMonitorEnabled && isSampling;

  return (
    <nav className="p-3">
      <ul className="menu menu-sm p-0 gap-1">
        <li>
          <Link
            to="/"
            className="[&.active]:bg-primary/10 [&.active]:text-base-content"
          >
            <FiActivity size={20} />
            <span className="font-medium">Current Session</span>
          </Link>
        </li>
        <li>
          <Link
            to="/sessions"
            className="[&.active]:bg-primary/10 [&.active]:text-base-content"
          >
            <FiBarChart2 size={20} />
            <span className="font-medium">Sessions</span>
          </Link>
        </li>
        <li>
          <Link
            to="/statistics"
            className="[&.active]:bg-primary/10 [&.active]:text-base-content"
          >
            <FiBarChart2 size={20} />
            <span className="font-medium">Statistics</span>
          </Link>
        </li>
        <li>
          <Link
            to="/cards"
            className="[&.active]:bg-primary/10 [&.active]:text-base-content"
          >
            <GiCardRandom size={20} />
            <span className="font-medium">Cards</span>
          </Link>
        </li>
        <li>
          <Link
            to="/profit-forecast"
            className="[&.active]:bg-primary/10 [&.active]:text-base-content"
          >
            <FiTrendingUp size={20} />
            <span className="font-medium">Profit Forecast</span>
          </Link>
        </li>
        <li>
          <Link
            to="/rarity-insights"
            className="[&.active]:bg-primary/10 [&.active]:text-base-content"
          >
            <MdCompareArrows size={20} />
            <span className="font-medium">Rarity Insights</span>
          </Link>
        </li>
        {showAppPerformanceNav && (
          <li>
            {isSampling ? (
              <Link
                to="/app-performance/live"
                className="[&.active]:bg-primary/10 [&.active]:text-base-content"
              >
                <span className="relative inline-flex shrink-0 text-primary">
                  <FiCpu size={20} />
                  <FiCpu
                    aria-hidden="true"
                    size={20}
                    className="app-performance-icon-shimmer absolute inset-0"
                  />
                </span>
                <span className="flex min-w-0 flex-1 items-center justify-between gap-1">
                  <span className="truncate font-medium">
                    {appPerformanceLabel}
                  </span>
                  {isSampling && (
                    <span className="shrink-0 text-[10px] tabular-nums text-base-content/50">
                      {formatCompactElapsed(captureTimer)}
                    </span>
                  )}
                </span>
              </Link>
            ) : (
              <Link
                to="/app-performance"
                className="[&.active]:bg-primary/10 [&.active]:text-base-content"
              >
                <FiCpu size={20} />
                <span className="flex min-w-0 flex-1 items-center justify-between gap-1">
                  <span className="truncate font-medium">
                    {appPerformanceLabel}
                  </span>
                  {isSampling && (
                    <span className="shrink-0 text-[10px] tabular-nums text-base-content/50">
                      {formatCompactElapsed(captureTimer)}
                    </span>
                  )}
                </span>
              </Link>
            )}
          </li>
        )}
      </ul>
      {showSidebarPerformanceCharts && (
        <SidebarPerformanceMiniCharts samples={samples} />
      )}
    </nav>
  );
}

function formatCompactElapsed(timer: {
  hours: number;
  minutes: number;
  seconds: number;
}): string {
  if (timer.hours > 0) {
    return formatTickingTimer(timer)
      .replace("h ", ":")
      .replace("m ", ":")
      .replace("s", "");
  }

  return `${timer.minutes}:${String(timer.seconds).padStart(2, "0")}`;
}
