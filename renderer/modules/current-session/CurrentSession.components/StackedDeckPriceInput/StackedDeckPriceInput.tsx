import { type ChangeEvent, useState } from "react";

import { Stat } from "~/renderer/components";
import Tooltip from "~/renderer/components/Tooltip/Tooltip";
import { useBoundStore } from "~/renderer/store";
import { type GameType, MAX_SESSION_INPUT_CHAOS } from "~/types/data-stores";

const priceDescription = [
  "Override the chaos price paid per Stacked Deck for the current and future sessions.",
  "Updates deck costs and net profit.",
  "Clear to use the session's poe.ninja price.",
];

const StackedDeckPriceInput = () => {
  const game = useBoundStore((state) => state.settings.selectedGame);
  const override = useBoundStore(
    (state) =>
      state.currentSession.stackedDeckPriceOverrides[
        state.settings.selectedGame
      ],
  );
  const snapshotPrice = useBoundStore(
    (state) =>
      state.currentSession.getSession()?.priceSnapshot?.stackedDeckChaosCost,
  );
  const setOverride = useBoundStore(
    (state) => state.currentSession.setStackedDeckPriceOverride,
  );
  const error = useBoundStore(
    (state) =>
      state.currentSession.stackedDeckPriceErrors[state.settings.selectedGame],
  );
  const isLoading = useBoundStore((state) => state.currentSession.isLoading);
  const [draft, setDraft] = useState<{
    game: GameType;
    value: string;
    price: number | null;
  } | null>(null);
  const inputValue =
    draft?.game === game && draft.price === override
      ? draft.value
      : (override?.toString() ?? "");

  const handlePriceChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.value.trim();
    if (!/^\d{0,3}(?:[.,]\d*)?$/.test(value)) return;
    if (value === "," || value === ".") {
      setDraft({ game, value, price: override });
      return;
    }
    const price = value === "" ? null : Number(value.replace(",", "."));
    if (
      price !== null &&
      (!Number.isFinite(price) || price > MAX_SESSION_INPUT_CHAOS)
    )
      return;
    setDraft({ game, value, price });
    void setOverride(price);
  };

  const handlePriceBlur = () => {
    if (draft?.value === "," || draft?.value === ".") setDraft(null);
  };

  return (
    <Stat className="min-w-0">
      <Stat.Title>
        <Tooltip
          tabIndex={0}
          content={
            <span className="flex flex-col gap-2 text-left">
              {priceDescription.map((paragraph) => (
                <span key={paragraph}>{paragraph}</span>
              ))}
            </span>
          }
          className="underline decoration-dotted cursor-help"
        >
          <label htmlFor="stacked-deck-price">Override Deck Price</label>
        </Tooltip>
      </Stat.Title>
      <Stat.Value className="flex min-w-0 items-baseline gap-2">
        <input
          id="stacked-deck-price"
          className="w-full min-w-0 border-0 border-b border-base-content/30 bg-transparent p-0 placeholder:text-base-content/50 focus:border-primary focus:outline-none"
          type="text"
          disabled={isLoading}
          inputMode="decimal"
          placeholder={snapshotPrice?.toFixed(2) ?? ""}
          value={inputValue}
          onChange={handlePriceChange}
          onBlur={handlePriceBlur}
          aria-describedby="stacked-deck-price-help"
          aria-invalid={!!error}
        />
        <span className="shrink-0 text-xs font-normal text-base-content/60">
          chaos / deck
        </span>
      </Stat.Value>
      <Stat.Desc className="whitespace-normal">
        {override === null ? "Using poe.ninja price" : "Custom price per deck"}
      </Stat.Desc>
      <span id="stacked-deck-price-help" className="sr-only">
        {priceDescription.join(" ")}
      </span>
      {error && (
        <p role="alert" className="text-xs text-error">
          {error}
        </p>
      )}
    </Stat>
  );
};

export default StackedDeckPriceInput;
