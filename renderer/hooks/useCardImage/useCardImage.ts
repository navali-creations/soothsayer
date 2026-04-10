import { useEffect, useState } from "react";

import { getCardImage, loadCardImage } from "~/renderer/lib/poe1-card-assets";

/**
 * Hook that lazily loads a card image and returns its URL.
 * Returns empty string while loading, then the resolved URL.
 */
export function useCardImage(artSrc: string): string {
  // Check the synchronous cache first — avoids a render cycle for cached images
  const [src, setSrc] = useState(() => getCardImage(artSrc));

  useEffect(() => {
    // If already cached from the initial state, skip
    const cached = getCardImage(artSrc);
    if (cached) {
      setSrc(cached);
      return;
    }

    let cancelled = false;
    loadCardImage(artSrc).then((url) => {
      if (!cancelled) setSrc(url);
    });

    return () => {
      cancelled = true;
    };
  }, [artSrc]);

  return src;
}
