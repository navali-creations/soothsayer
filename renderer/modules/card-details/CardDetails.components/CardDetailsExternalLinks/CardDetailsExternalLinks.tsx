import { FiExternalLink } from "react-icons/fi";

import { Button } from "~/renderer/components";
import { cardNameToSlug } from "~/renderer/utils";
import { CARD_REFERENCE_ORIGINS } from "~/types/card-reference-links";

import { wraeclastCardSlug } from "./CardDetailsExternalLinks.utils";

interface CardDetailsExternalLinksProps {
  cardName: string;
  game: "poe1" | "poe2";
  league?: string | null;
}

// ─── Allowed external origins ────────────────────────────────────────────────
//
// These origins are also present in MainWindowService's `setWindowOpenHandler`
// allowlist. All `window.open` calls from the renderer are intercepted by
// Electron's main process which:
//
//   1. Checks the URL against the allowlist.
//   2. Opens matching URLs via `shell.openExternal` (OS default browser).
//   3. Blocks and logs any URL that doesn't match.
//   4. Always returns `{ action: "deny" }` — no new Electron windows are created.
//
// The shared origins keep renderer URL construction and the main-process
// allowlist aligned. Card and league values are appended only as path segments.
// ─────────────────────────────────────────────────────────────────────────────

export const CardDetailsExternalLinks = ({
  cardName,
  game,
  league,
}: CardDetailsExternalLinksProps) => {
  const slug = cardNameToSlug(cardName);
  const gamePrefix = game === "poe1" ? "poe1" : "poe2";
  const wraeclastGame = game === "poe1" ? "path-of-exile" : "path-of-exile-2";
  const leagueSlug = cardNameToSlug(league ?? "standard");
  const poedbSlug = cardName
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const wikiUrl = `${CARD_REFERENCE_ORIGINS.wiki}/wiki/${encodeURIComponent(cardName)}`;
  const ninjaUrl = `${CARD_REFERENCE_ORIGINS.ninja}/${gamePrefix}/economy/divination-cards/${slug}`;
  const poedbUrl = `${game === "poe1" ? CARD_REFERENCE_ORIGINS.poedb : CARD_REFERENCE_ORIGINS.poe2db}/us/${encodeURIComponent(poedbSlug)}`;
  const wraeclastCardsUrl = `${CARD_REFERENCE_ORIGINS.wraeclastCards}/${wraeclastGame}/${leagueSlug}/cards/${wraeclastCardSlug(cardName)}`;

  // Security: `window.open` is intercepted by `setWindowOpenHandler` in
  // MainWindowService — see comment block above for details.
  const openExternal = (url: string) => {
    window.open(url, "_blank");
  };

  const handleOpenWiki = () => openExternal(wikiUrl);
  const handleOpenNinja = () => openExternal(ninjaUrl);
  const handleOpenPoedb = () => openExternal(poedbUrl);
  const handleOpenWraeclastCards = () => openExternal(wraeclastCardsUrl);

  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        variant="ghost"
        size="sm"
        className="justify-between gap-2"
        onClick={handleOpenWiki}
      >
        <span className="text-xs">poewiki.net</span>
        <FiExternalLink className="w-3.5 h-3.5 shrink-0 opacity-50" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="justify-between gap-2"
        onClick={handleOpenNinja}
      >
        <span className="text-xs">poe.ninja</span>
        <FiExternalLink className="w-3.5 h-3.5 shrink-0 opacity-50" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="justify-between gap-2"
        onClick={handleOpenPoedb}
      >
        <span className="text-xs">PoEDB</span>
        <FiExternalLink className="w-3.5 h-3.5 shrink-0 opacity-50" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="justify-between gap-2"
        onClick={handleOpenWraeclastCards}
      >
        <span className="text-xs">wraeclast.cards</span>
        <FiExternalLink className="w-3.5 h-3.5 shrink-0 opacity-50" />
      </Button>
    </div>
  );
};

export default CardDetailsExternalLinks;
