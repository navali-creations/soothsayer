import type { CSSProperties } from "react";

interface AnimatedNumberProps {
  value: number;
  className?: string;
  decimals?: number;
  suffix?: string;
  duration?: number;
}

const AnimatedNumber = ({
  value,
  className = "",
  decimals = 0,
  suffix = "",
  duration = 0.8,
}: AnimatedNumberProps) => {
  const isNegative = value < 0;
  const absValue = Math.abs(value);

  const style: CSSProperties & Record<string, number | string> = {
    "--target-value": absValue,
    "--animation-duration": `${duration}s`,
  };

  return (
    <span
      className={`animated-number animated-number--decimals-${decimals} ${className}`.trim()}
      style={style}
      data-suffix={suffix}
      data-sign={isNegative ? "-" : ""}
    />
  );
};

export default AnimatedNumber;
