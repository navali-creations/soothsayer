import { FiExternalLink } from "react-icons/fi";

import { Button } from "~/renderer/components";
import { cardNameToSlug } from "~/renderer/utils";

interface CardDetailsExternalLinksProps {
  cardName: string;
  game: "poe1" | "poe2";
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
// We hardcode the origins here to make it obvious during code review that only
// trusted destinations can be reached. The `cardName` / slug is appended as a
// path segment (never as a scheme or host), so it cannot redirect to an
// arbitrary origin.
// ─────────────────────────────────────────────────────────────────────────────

const WIKI_ORIGIN = "https://www.poewiki.net";
const NINJA_ORIGIN = "https://poe.ninja";

export const CardDetailsExternalLinks = ({
  cardName,
  game,
}: CardDetailsExternalLinksProps) => {
  const slug = cardNameToSlug(cardName);
  const gamePrefix = game === "poe1" ? "poe1" : "poe2";

  const wikiUrl = `${WIKI_ORIGIN}/wiki/${encodeURIComponent(cardName)}`;
  const ninjaUrl = `${NINJA_ORIGIN}/${gamePrefix}/economy/divination-cards/${slug}`;

  // Security: `window.open` is intercepted by `setWindowOpenHandler` in
  // MainWindowService — see comment block above for details.
  const openExternal = (url: string) => {
    window.open(url, "_blank");
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        variant="ghost"
        size="sm"
        className="justify-between gap-2"
        onClick={() => openExternal(wikiUrl)}
      >
        <span className="text-xs">poewiki.net</span>
        <FiExternalLink className="w-3.5 h-3.5 shrink-0 opacity-50" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="justify-between gap-2"
        onClick={() => openExternal(ninjaUrl)}
      >
        <span className="text-xs">poe.ninja</span>
        <FiExternalLink className="w-3.5 h-3.5 shrink-0 opacity-50" />
      </Button>
    </div>
  );
};

export default CardDetailsExternalLinks;
