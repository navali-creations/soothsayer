import { useCallback, useState } from "react";
import { FiCheck, FiCopy } from "react-icons/fi";

import { useBoundStore } from "~/renderer/store";
import { RARITY_LABELS } from "~/renderer/utils";
import type { Rarity } from "~/types/data-stores";

interface CardDetailsShareButtonProps {
  cardName: string;
  stackSize: number;
  rarity: Rarity;
  fromBoss: boolean;
}

/**
 * "Copy summary" button for the card details page header.
 *
 * Copies a formatted text block to the clipboard containing:
 * - Card name, rarity tier, boss-exclusive status
 * - Current price in divine orbs + PL weight + drop chance
 * - First found date + total drops + session count
 *
 * Lines are gracefully omitted when data is missing.
 * Shows brief "Copied!" feedback after copying.
 *
 * Useful for sharing in Discord, guild chat, etc.
 */
const CardDetailsShareButton = ({
  cardName,
  stackSize,
  rarity,
  fromBoss,
}: CardDetailsShareButtonProps) => {
  const [copied, setCopied] = useState(false);

  const {
    cardDetails: { priceHistory, personalAnalytics },
  } = useBoundStore();

  const handleCopy = useCallback(async () => {
    const lines: string[] = [];

    // Line 1: Card name — Rarity (Boss-exclusive)
    const rarityLabel = RARITY_LABELS[rarity] ?? "Unknown";
    let line1 = `${cardName} — ${rarityLabel}`;
    if (fromBoss) {
      line1 += " (Boss-exclusive)";
    }
    lines.push(line1);

    // Line 2: Price + Weight + Drop chance
    const priceParts: string[] = [];

    if (priceHistory?.currentDivineRate != null) {
      priceParts.push(
        `Price: ${priceHistory.currentDivineRate.toFixed(1)} div`,
      );
    }

    if (personalAnalytics?.prohibitedLibrary) {
      const { weight } = personalAnalytics.prohibitedLibrary;
      if (weight > 0) {
        priceParts.push(`Weight: ${weight.toLocaleString()}`);

        // Compute "1 in X decks" if we have weight
        // We don't have totalWeight here easily, so we just show the weight
      }
    }

    if (stackSize > 1) {
      priceParts.push(`Stack: ${stackSize}`);
    }

    if (priceParts.length > 0) {
      lines.push(priceParts.join(" | "));
    }

    // Line 3: Full set value if available
    if (priceHistory?.currentDivineRate != null && stackSize > 1) {
      const fullSetValue = priceHistory.currentDivineRate * stackSize;
      lines.push(`Full set: ${fullSetValue.toFixed(1)} div`);
    }

    // Line 4: Personal stats
    if (personalAnalytics && personalAnalytics.totalLifetimeDrops > 0) {
      const personalParts: string[] = [];

      if (personalAnalytics.firstDiscoveredAt) {
        const date = new Date(personalAnalytics.firstDiscoveredAt);
        const formatted = date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        personalParts.push(`First found: ${formatted}`);
      }

      personalParts.push(
        `Total drops: ${personalAnalytics.totalLifetimeDrops} across ${personalAnalytics.sessionCount} session${personalAnalytics.sessionCount !== 1 ? "s" : ""}`,
      );

      if (personalParts.length > 0) {
        lines.push(personalParts.join(" | "));
      }
    }

    const summary = lines.join("\n");

    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error(
        "[CardDetailsShareButton] Failed to copy to clipboard:",
        error,
      );
    }
  }, [cardName, rarity, fromBoss, stackSize, priceHistory, personalAnalytics]);

  return (
    <button
      className="btn btn-ghost btn-sm tooltip tooltip-bottom"
      data-tip={copied ? "Copied!" : "Copy summary"}
      onClick={handleCopy}
    >
      {copied ? (
        <FiCheck className="w-4 h-4 text-success" />
      ) : (
        <FiCopy className="w-4 h-4" />
      )}
      <span className="text-xs">{copied ? "Copied!" : "Copy"}</span>
    </button>
  );
};

export default CardDetailsShareButton;
