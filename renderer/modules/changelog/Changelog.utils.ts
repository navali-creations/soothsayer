export type ChangeTypeColor = "info" | "success" | "warning" | "accent";

export const changeTypeColor = (changeType: string): ChangeTypeColor => {
  const lower = changeType.toLowerCase();
  if (lower.includes("minor")) return "success";
  if (lower.includes("major")) return "warning";
  if (lower.includes("patch")) return "info";
  return "accent";
};
