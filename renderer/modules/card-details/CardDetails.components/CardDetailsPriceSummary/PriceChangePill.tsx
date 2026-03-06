import { FiTrendingDown, FiTrendingUp } from "react-icons/fi";

// ─── Price Change Pill ─────────────────────────────────────────────────────

function PriceChangePill({
  label,
  change,
}: {
  label: string;
  change: number | undefined;
}) {
  if (change === undefined || change === null) return null;

  const isPositive = change > 0;
  const isZero = change === 0;
  const color = isZero
    ? "text-base-content/60"
    : isPositive
      ? "text-success"
      : "text-error";

  const icon = isZero ? null : isPositive ? (
    <FiTrendingUp className="w-3 h-3" />
  ) : (
    <FiTrendingDown className="w-3 h-3" />
  );

  const sign = isPositive ? "+" : "";

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] uppercase text-base-content/40 font-semibold">
        {label}
      </span>
      <span
        className={`flex items-center gap-1 text-sm font-semibold ${color}`}
      >
        {icon}
        {sign}
        {change.toFixed(1)}%
      </span>
    </div>
  );
}

export default PriceChangePill;
