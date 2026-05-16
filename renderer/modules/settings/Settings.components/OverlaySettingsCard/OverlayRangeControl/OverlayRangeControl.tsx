import type { ChangeEvent, ReactNode } from "react";

interface OverlayRangeControlProps {
  icon: ReactNode;
  label: string;
  value: number;
  displayValue: string;
  min: number;
  max: number;
  step: number;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  description?: string;
}

export function OverlayRangeControl({
  icon,
  label,
  value,
  displayValue,
  min,
  max,
  step,
  onChange,
  description,
}: OverlayRangeControlProps) {
  return (
    <div className="form-control">
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm text-base-content/70 min-w-17">{label}</span>
        <input
          type="range"
          className="range range-primary range-xs flex-1"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={onChange}
        />
        <span className="text-sm font-mono text-base-content/70 min-w-11 text-right tabular-nums">
          {displayValue}
        </span>
      </div>
      {description && (
        <p className="text-xs text-base-content/40 mt-1 ml-7">{description}</p>
      )}
    </div>
  );
}
