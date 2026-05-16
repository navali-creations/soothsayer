interface SummaryCellProps {
  label: string;
  value: number | null;
  secondaryValue: number | null;
  format: (value: number | null) => string;
  secondaryFormat?: (value: number | null) => string;
  secondaryLabel?: string;
}

export function SummaryCell({
  label,
  value,
  secondaryValue,
  format,
  secondaryFormat,
  secondaryLabel,
}: SummaryCellProps) {
  const hasSecondary =
    secondaryFormat !== undefined &&
    typeof secondaryValue === "number" &&
    Number.isFinite(secondaryValue);

  return (
    <div className="min-w-0 px-2 py-1.5">
      <div className="text-[9px] font-medium uppercase leading-none text-base-content/45">
        {label}
      </div>
      <div className="mt-1 truncate text-xs font-semibold leading-tight tabular-nums text-base-content/90">
        {format(value)}
      </div>
      {hasSecondary && (
        <div className="mt-0.5 truncate text-[9px] leading-tight tabular-nums text-base-content/45">
          {secondaryFormat(secondaryValue)}
          {secondaryLabel ? ` ${secondaryLabel}` : ""}
        </div>
      )}
    </div>
  );
}
