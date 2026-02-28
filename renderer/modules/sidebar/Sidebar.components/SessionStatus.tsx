import { Countdown, Flex } from "~/renderer/components";
import { useTickingTimer } from "~/renderer/hooks";
import { useBoundStore } from "~/renderer/store";

const SessionStatus = () => {
  const {
    currentSession: { getIsCurrentSessionActive, getSessionInfo },
  } = useBoundStore();

  const isActive = getIsCurrentSessionActive();
  const sessionInfo = getSessionInfo();

  const time = useTickingTimer({
    referenceTime: sessionInfo?.startedAt ?? null,
    direction: "up",
    enabled: isActive && !!sessionInfo,
  });

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
            <Countdown timer={time} size="base" showLabels alwaysShowHours />
          </div>
        </div>
      </Flex>
    </div>
  );
};

export default SessionStatus;
