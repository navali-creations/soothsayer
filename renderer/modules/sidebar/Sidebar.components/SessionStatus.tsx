import { useEffect, useState } from "react";

import { Flex } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";

const SessionStatus = () => {
  const {
    currentSession: { getIsCurrentSessionActive, getSessionInfo },
  } = useBoundStore();

  const isActive = getIsCurrentSessionActive();
  const sessionInfo = getSessionInfo();
  const [time, setTime] = useState({ hours: 0, minutes: 0, seconds: 0 });

  // Update time every second when session is active
  useEffect(() => {
    if (!isActive || !sessionInfo) {
      setTime({ hours: 0, minutes: 0, seconds: 0 });
      return;
    }

    const updateTime = () => {
      const start = new Date(sessionInfo.startedAt);
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
  }, [isActive, sessionInfo]);

  return (
    <div className="p-3 pl-5 transition-colors preview">
      <Flex className="justify-between items-start">
        <div className="flex-1">
          <div className="text-xs text-base-content/50 uppercase tracking-wide font-medium mb-0.5">
            Session
          </div>
          <div className="font-semibold mb-2 text-base-content">Active</div>

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
                      {
                        "--value": time.hours,
                        "--digits": 2,
                      } as React.CSSProperties
                    }
                  ></span>
                </span>
                <span className="text-[9px] text-base-content/50 uppercase tracking-tight">
                  hrs
                </span>
              </div>
              <span className="text-base-content/50 pb-[14px] text-sm">:</span>
              <div className="flex flex-col items-center">
                <span className="countdown text-base tabular-nums font-mono text-base-content">
                  <span
                    style={
                      {
                        "--value": time.minutes,
                        "--digits": 2,
                      } as React.CSSProperties
                    }
                  ></span>
                </span>
                <span className="text-[9px] text-base-content/50 uppercase tracking-tight">
                  min
                </span>
              </div>
              <span className="text-base-content/50 pb-[14px] text-sm">:</span>
              <div className="flex flex-col items-center">
                <span className="countdown text-base tabular-nums font-mono text-base-content">
                  <span
                    style={
                      {
                        "--value": time.seconds,
                        "--digits": 2,
                      } as React.CSSProperties
                    }
                  ></span>
                </span>
                <span className="text-[9px] text-base-content/50 uppercase tracking-tight">
                  sec
                </span>
              </div>
            </div>
          </div>
        </div>
      </Flex>
    </div>
  );
};

export default SessionStatus;
