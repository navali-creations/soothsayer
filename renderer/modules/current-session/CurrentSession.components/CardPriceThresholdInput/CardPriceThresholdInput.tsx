import type { ChangeEvent } from "react";

import { Stat } from "~/renderer/components";
import Tooltip from "~/renderer/components/Tooltip/Tooltip";
import { useBoundStore } from "~/renderer/store";
import { MAX_SESSION_INPUT_CHAOS } from "~/types/data-stores";

const thresholdDescription = [
  "Excludes cards worth less than this chaos value from session totals and profit.",
  "Applies to existing and new drops.",
  "Clear or set to 0 to disable automatic hiding.",
];

const CardPriceThresholdInput = () => {
  const threshold = useBoundStore(
    (state) =>
      state.currentSession.cardPriceThresholds[state.settings.selectedGame],
  );
  const setThreshold = useBoundStore(
    (state) => state.currentSession.setCardPriceThreshold,
  );
  const error = useBoundStore(
    (state) =>
      state.currentSession.cardPriceThresholdErrors[
        state.settings.selectedGame
      ],
  );
  const isLoading = useBoundStore((state) => state.currentSession.isLoading);

  const handleThresholdChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.currentTarget.validity.valid) return;
    const value =
      event.currentTarget.value === "" ? 0 : event.currentTarget.valueAsNumber;
    void setThreshold(value);
  };

  return (
    <Stat className="min-w-0">
      <Stat.Title>
        <Tooltip
          tabIndex={0}
          content={
            <span className="flex flex-col gap-2 text-left">
              {thresholdDescription.map((paragraph) => (
                <span key={paragraph}>{paragraph}</span>
              ))}
            </span>
          }
          className="underline decoration-dotted cursor-help"
        >
          <label htmlFor="card-price-threshold">Threshold</label>
        </Tooltip>
      </Stat.Title>
      <Stat.Value className="flex min-w-0 items-baseline gap-2">
        <input
          id="card-price-threshold"
          className="w-full min-w-0 border-0 border-b border-base-content/30 bg-transparent p-0 placeholder:text-base-content focus:border-primary focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          type="number"
          disabled={isLoading}
          min="0"
          max={MAX_SESSION_INPUT_CHAOS}
          step="any"
          placeholder="0"
          value={threshold || ""}
          onChange={handleThresholdChange}
          aria-describedby="card-price-threshold-help"
          aria-invalid={!!error}
        />
        <span className="text-xs font-normal text-base-content/60">chaos</span>
      </Stat.Value>
      <Stat.Desc className="whitespace-normal">0 disables hiding</Stat.Desc>
      <span id="card-price-threshold-help" className="sr-only">
        {thresholdDescription.join(" ")}
      </span>
      {error && (
        <p role="alert" className="text-xs text-error">
          {error}
        </p>
      )}
    </Stat>
  );
};

export default CardPriceThresholdInput;
