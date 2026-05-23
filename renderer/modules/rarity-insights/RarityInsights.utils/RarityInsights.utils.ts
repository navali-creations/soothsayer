import type { FilterThemeDTO } from "~/main/modules/rarity-insights/RarityInsights.dto";
import type { FilterTheme } from "~/renderer/utils";

export function toFilterTheme(rows: FilterThemeDTO): FilterTheme | null {
  if (rows.length === 0) {
    return null;
  }

  const theme: FilterTheme = {};
  for (const row of rows) {
    theme[row.rarity] = {
      bgColor: row.bgColor,
      textColor: row.textColor,
      borderColor: row.borderColor,
    };
  }

  return theme;
}
