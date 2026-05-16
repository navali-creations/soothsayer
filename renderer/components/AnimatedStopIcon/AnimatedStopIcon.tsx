interface AnimatedStopIconProps {
  className?: string;
}

export function AnimatedStopIcon({
  className = "w-4 h-4",
}: AnimatedStopIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <rect
        className="
          stroke-current
          stroke-3
          fill-none
          [stroke-linecap:butt]
          [stroke-dasharray:42_8]
          animate-stop-session
        "
        x="3"
        y="3"
        width="18"
        height="18"
        rx="2"
        ry="2"
        pathLength="100"
      />
    </svg>
  );
}
