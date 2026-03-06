import { Flex } from "~/renderer/components";
import { getRarityStyles, RARITY_LABELS } from "~/renderer/utils";
import type { Rarity } from "~/types/data-stores";

interface HeaderSubtitleProps {
  rarity: Rarity;
  fromBoss: boolean;
}

const HeaderSubtitle = ({ rarity, fromBoss }: HeaderSubtitleProps) => {
  const styles = getRarityStyles(rarity);
  const rarityLabel = RARITY_LABELS[rarity] ?? "Unknown";

  return (
    <Flex className="items-center gap-2">
      <span
        className="badge badge-sm whitespace-nowrap"
        style={{
          backgroundColor: styles.badgeBg,
          color: styles.badgeText,
          borderColor: styles.badgeBorder,
          borderWidth: "1px",
          borderStyle: "solid",
        }}
      >
        {rarityLabel}
      </span>
      {fromBoss && (
        <span className="badge badge-sm badge-warning whitespace-nowrap">
          Boss-exclusive
        </span>
      )}
    </Flex>
  );
};

export default HeaderSubtitle;
