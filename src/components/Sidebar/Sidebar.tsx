import { FiActivity, FiBarChart2, FiSettings } from "react-icons/fi";
import { GiCardExchange } from "react-icons/gi";
import { Link, Flex } from "..";
import {
  useSession,
  useDivinationCards,
  usePoeNinjaExchangePrices,
} from "../../hooks";
import { formatCurrency } from "../../api/poe-ninja";
import { useMemo, useEffect, useState } from "react";
import pkgJson from "../../../package.json" with { type: "json" };

const Sidebar = () => {
  const session = useSession({ game: "poe1" });
  const { stats } = useDivinationCards();
  const [time, setTime] = useState({ hours: 0, minutes: 0, seconds: 0 });

  // Fetch exchange prices for the active session's league
  const { chaosToDivineRatio, cardPrices } = usePoeNinjaExchangePrices(
    session.sessionInfo?.league || "Keepers",
    session.isActive,
  );

  // Update time every second when session is active
  useEffect(() => {
    if (!session.isActive || !session.sessionInfo) {
      setTime({ hours: 0, minutes: 0, seconds: 0 });
      return;
    }

    const updateTime = () => {
      const start = new Date(session.sessionInfo!.startedAt);
      const now = new Date();
      const diff = now.getTime() - start.getTime();

      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      setTime({ hours, minutes, seconds });
    };

    // Update immediately
    updateTime();

    // Then update every second
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, [session.isActive, session.sessionInfo]);

  // Calculate total profit
  const totalProfit = useMemo(() => {
    if (!stats) return 0;

    return Object.entries(stats.cards).reduce((sum, [name, entry]) => {
      const price = cardPrices[name];
      const chaosValue = price?.chaosValue || 0;
      return sum + chaosValue * entry.count;
    }, 0);
  }, [stats, cardPrices]);

  return (
    <aside className="w-64 bg-base-200 border-r border-base-300 flex flex-col h-screen">
      {/* Status Cards */}
      <div className="p-3 space-y-2">
        {/* Session Status Card */}
        <div
          className={`border-l-4 ${session.isActive ? "border-l-warning bg-base-100" : "border-l-base-300 bg-base-100"} rounded-r-lg p-3 transition-colors`}
        >
          <Flex className="justify-between items-start">
            <div className="flex-1">
              <div className="text-xs text-base-content/50 uppercase tracking-wide font-medium mb-0.5">
                Session
              </div>
              <div className="font-semibold mb-2 text-base-content">
                {session.isActive ? "Active" : "Waiting"}
              </div>
              {session.isActive && (
                <div className="space-y-2">
                  {/* Duration label */}
                  <div className="text-xs text-base-content/60 font-medium">
                    Duration
                  </div>
                  {/* Countdown timer */}
                  <div className="flex gap-1.5 items-end">
                    <div className="flex flex-col items-center">
                      <span className="countdown text-base tabular-nums font-mono text-base-content">
                        <span
                          style={
                            { "--value": time.hours } as React.CSSProperties
                          }
                          aria-label={`${time.hours} hours`}
                        >
                          {String(time.hours).padStart(2, "0")}
                        </span>
                      </span>
                      <span className="text-[9px] text-base-content/50 uppercase tracking-tight">
                        hrs
                      </span>
                    </div>
                    <span className="text-base-content/50 pb-[14px] text-sm">
                      :
                    </span>
                    <div className="flex flex-col items-center">
                      <span className="countdown text-base tabular-nums font-mono text-base-content">
                        <span
                          style={
                            { "--value": time.minutes } as React.CSSProperties
                          }
                          aria-label={`${time.minutes} minutes`}
                        >
                          {String(time.minutes).padStart(2, "0")}
                        </span>
                      </span>
                      <span className="text-[9px] text-base-content/50 uppercase tracking-tight">
                        min
                      </span>
                    </div>
                    <span className="text-base-content/50 pb-[14px] text-sm">
                      :
                    </span>
                    <div className="flex flex-col items-center">
                      <span className="countdown text-base tabular-nums font-mono text-base-content">
                        <span
                          style={
                            { "--value": time.seconds } as React.CSSProperties
                          }
                          aria-label={`${time.seconds} seconds`}
                        >
                          {String(time.seconds).padStart(2, "0")}
                        </span>
                      </span>
                      <span className="text-[9px] text-base-content/50 uppercase tracking-tight">
                        sec
                      </span>
                    </div>
                  </div>
                  {/* Stacked Decks count */}
                  <div className="text-xs text-base-content/60 font-medium">
                    Stacked Decks Opened
                  </div>
                  <div className="font-semibold tabular-nums text-base-content">
                    {stats?.totalCount || 0}
                  </div>
                </div>
              )}
            </div>
            <FiActivity
              size={24}
              className={`transition-colors ${session.isActive ? "text-warning" : "text-base-content/30"}`}
            />
          </Flex>
        </div>

        {/* Profit Card */}
        {session.isActive && (
          <div className="bg-base-100 border-l-4 border-l-base-300 rounded-r-lg p-3">
            <Flex className="justify-between items-start">
              <div className="flex-1">
                <div className="text-xs text-base-content/50 uppercase tracking-wide font-medium mb-0.5">
                  Total Opened Value
                </div>
                <div className="font-semibold tabular-nums text-base-content">
                  {formatCurrency(totalProfit, chaosToDivineRatio)}
                </div>
                {session.sessionInfo && (
                  <div className="text-xs text-base-content/70 mt-1">
                    {session.sessionInfo.league}
                  </div>
                )}
              </div>
              <GiCardExchange size={24} className="text-base-content/30" />
            </Flex>
          </div>
        )}
      </div>

      <div className="divider my-0"></div>

      {/* Navigation Section */}
      <div className="flex-1 px-3 py-4">
        <div className="text-xs text-base-content/40 uppercase tracking-wide font-medium mb-3 px-3">
          Navigation
        </div>
        <ul className="menu menu-sm p-0">
          <li>
            <Link
              to="/current-session"
              className="[&.active]:bg-primary [&.active]:text-primary-content"
            >
              <FiActivity size={20} />
              <span className="font-medium">Current Session</span>
            </Link>
          </li>
          <li>
            <Link
              to="/sessions"
              className="[&.active]:bg-primary [&.active]:text-primary-content"
            >
              <FiBarChart2 size={20} />
              <span className="font-medium">Sessions</span>
            </Link>
          </li>
          <li>
            <Link
              to="/stats"
              className="[&.active]:bg-primary [&.active]:text-primary-content"
            >
              <FiBarChart2 size={20} />
              <span className="font-medium">Statistics</span>
            </Link>
          </li>
        </ul>
      </div>

      <div className="divider my-0"></div>

      {/* Settings Section */}
      <div className="px-3 py-4">
        <div className="text-xs text-base-content/40 uppercase tracking-wide font-medium mb-3 px-3">
          Settings
        </div>
        <ul className="menu menu-sm p-0">
          <li>
            <Link
              to="/settings"
              className="[&.active]:bg-primary [&.active]:text-primary-content"
            >
              <FiSettings size={20} />
              <span className="font-medium">General</span>
            </Link>
          </li>
        </ul>
      </div>

      {/* Footer - Version */}
      <div className="p-4 border-t border-base-300">
        <div className="text-xs text-base-content/40 text-center tabular-nums">
          Version {pkgJson.version}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
