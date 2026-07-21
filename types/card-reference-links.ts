export const CARD_REFERENCE_ORIGINS = {
  ninja: "https://poe.ninja",
  poe2db: "https://poe2db.tw",
  poedb: "https://poedb.tw",
  wiki: "https://www.poewiki.net",
  wraeclastCards: "https://wraeclast.cards",
} as const;

export const CARD_REFERENCE_ALLOWED_ORIGINS = Object.values(
  CARD_REFERENCE_ORIGINS,
);
