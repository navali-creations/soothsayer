// ─── Confidence Display ────────────────────────────────────────────────────

const CONFIDENCE_CONFIG: Record<
  number,
  { label: string; emoji: string; color: string; tooltip: string }
> = {
  1: {
    label: "High",
    emoji: "🟢",
    color: "text-success",
    tooltip: "Price from exchange API with good volume — highly reliable",
  },
  2: {
    label: "Medium",
    emoji: "🟡",
    color: "text-warning",
    tooltip: "Price available but lower confidence (e.g. lower volume)",
  },
  3: {
    label: "Low",
    emoji: "🔴",
    color: "text-error",
    tooltip: "Stash-only price or very low volume — treat with caution",
  },
};

function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (confidence === null || confidence === 0) return null;

  const config = CONFIDENCE_CONFIG[confidence];
  if (!config) return null;

  return (
    <div className="tooltip tooltip-bottom" data-tip={config.tooltip}>
      <span className={`badge badge-sm gap-1 ${config.color} cursor-help`}>
        <span>{config.emoji}</span>
        {config.label} confidence
      </span>
    </div>
  );
}

export default ConfidenceBadge;
