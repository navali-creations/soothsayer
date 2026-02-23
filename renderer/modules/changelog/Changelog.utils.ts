export type ChangeTypeColor = "info" | "success" | "warning" | "accent";

export const changeTypeColor = (changeType: string): ChangeTypeColor => {
  const lower = changeType.toLowerCase();
  if (lower.includes("minor")) return "success";
  if (lower.includes("major")) return "warning";
  if (lower.includes("patch")) return "info";
  return "accent";
};

const hoverBorderClasses: Record<ChangeTypeColor, string> = {
  info: "hover:border-info",
  success: "hover:border-success",
  warning: "hover:border-warning",
  accent: "hover:border-accent",
};

export const hoverBorderColorClass = (color: ChangeTypeColor): string =>
  hoverBorderClasses[color];

const RELEASES_BASE_URL =
  "https://github.com/navali-creations/soothsayer/releases/tag";

export const releaseUrl = (version: string): string =>
  `${RELEASES_BASE_URL}/v${version}`;
