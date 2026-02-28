import clsx from "clsx";

import type { TickingTimerResult } from "~/renderer/hooks/useTickingTimer";

type CountdownSize = "xs" | "sm" | "base" | "lg";

interface CountdownProps {
  /** The ticking timer result from `useTickingTimer`. */
  timer: Pick<TickingTimerResult, "hours" | "minutes" | "seconds">;
  /** Text size preset. Defaults to "base". */
  size?: CountdownSize;
  /** Whether to show unit labels (hrs / min / sec) below each segment. Defaults to false. */
  showLabels?: boolean;
  /** Whether to show hours when they are 0. Defaults to false (auto-hide). */
  alwaysShowHours?: boolean;
  /** Additional class names for the outer wrapper. */
  className?: string;
}

const sizeClasses: Record<CountdownSize, string> = {
  xs: "text-xs",
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
};

const separatorPaddingClasses: Record<CountdownSize, string> = {
  xs: "pb-0",
  sm: "pb-0",
  base: "pb-[14px]",
  lg: "pb-[16px]",
};

const labelClasses = "text-[9px] text-base-content/50 uppercase tracking-tight";

/**
 * A single countdown segment (hours, minutes, or seconds) using DaisyUI's
 * `countdown` CSS variable pattern for smooth rolling digit transitions.
 */
const Segment = ({
  value,
  label,
  size,
  showLabel,
}: {
  value: number;
  label: string;
  size: CountdownSize;
  showLabel: boolean;
}) => (
  <div className={clsx("flex flex-col items-center", showLabel && "gap-0.5")}>
    <span
      className={clsx("countdown tabular-nums font-mono", sizeClasses[size])}
    >
      <span
        style={
          {
            "--value": value,
            "--digits": 2,
          } as React.CSSProperties
        }
      ></span>
    </span>
    {showLabel && <span className={labelClasses}>{label}</span>}
  </div>
);

const Separator = ({
  size,
  showLabels,
}: {
  size: CountdownSize;
  showLabels: boolean;
}) => (
  <span
    className={clsx(
      "text-base-content/50 text-sm",
      showLabels && separatorPaddingClasses[size],
    )}
  >
    :
  </span>
);

/**
 * Reusable countdown display using DaisyUI's `countdown` CSS variable pattern.
 *
 * Uses `--value` CSS custom properties for smooth rolling digit animations.
 * Accepts the result from `useTickingTimer` directly.
 *
 * @example
 * ```tsx
 * const timer = useTickingTimer({ referenceTime, direction: "down" });
 * <Countdown timer={timer} size="sm" />
 * ```
 */
const Countdown = ({
  timer,
  size = "base",
  showLabels = false,
  alwaysShowHours = false,
  className,
}: CountdownProps) => {
  const showHours = alwaysShowHours || timer.hours > 0;

  return (
    <span className={clsx("inline-flex gap-1.5 items-center", className)}>
      {showHours && (
        <>
          <Segment
            value={timer.hours}
            label="hrs"
            size={size}
            showLabel={showLabels}
          />
          <Separator size={size} showLabels={showLabels} />
        </>
      )}
      <Segment
        value={timer.minutes}
        label="min"
        size={size}
        showLabel={showLabels}
      />
      <Separator size={size} showLabels={showLabels} />
      <Segment
        value={timer.seconds}
        label="sec"
        size={size}
        showLabel={showLabels}
      />
    </span>
  );
};

export default Countdown;
