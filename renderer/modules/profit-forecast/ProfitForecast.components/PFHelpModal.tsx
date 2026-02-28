import { FiAlertTriangle, FiHelpCircle, FiX } from "react-icons/fi";

import { Button } from "~/renderer/components";

interface PFHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PFHelpModal = ({ isOpen, onClose }: PFHelpModalProps) => {
  if (!isOpen) return null;

  return (
    <dialog className="modal modal-open" onClick={onClose}>
      <div
        className="modal-box max-w-2xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <FiHelpCircle className="w-5 h-5 text-info" />
            Profit Forecast — How It Works
          </h3>
          <Button size="sm" circle variant="ghost" onClick={onClose}>
            <FiX className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-5 text-sm text-base-content/80">
          {/* P&L (card only) vs P&L (all drops) */}
          <section>
            <h4 className="font-semibold text-base text-base-content mb-2">
              P&amp;L (card only) vs P&amp;L (all drops)
            </h4>
            <div className="space-y-3">
              <div className="bg-base-200 rounded-lg p-3">
                <p className="font-medium text-base-content mb-1">
                  P&amp;L (card only)
                </p>
                <p>
                  Answers:{" "}
                  <em>
                    "If I only care about this one card, is it worth farming?"
                  </em>
                </p>
                <p className="mt-1">
                  It takes the card's sell price and subtracts the cost of all
                  the stacked decks you'd need to open (on average) to pull one
                  copy. Every other card you get along the way is{" "}
                  <strong>ignored</strong>.
                </p>
                <p className="mt-1 text-base-content/60">
                  Formula:{" "}
                  <code className="text-xs bg-base-300 px-1 rounded">
                    card price − cost of decks to pull it
                  </code>
                </p>
              </div>

              <div className="bg-base-200 rounded-lg p-3">
                <p className="font-medium text-base-content mb-1">
                  P&amp;L (all drops)
                </p>
                <p>
                  Answers:{" "}
                  <em>
                    "What's my actual profit if I sell everything I find while
                    farming this card?"
                  </em>
                </p>
                <p className="mt-1">
                  While opening enough decks to pull the target card, you'll
                  also get many other cards. This column accounts for all of
                  them — it uses the EV (expected value) of every deck times the
                  number of decks needed, minus the total cost of those decks.
                </p>
                <p className="mt-1 text-base-content/60">
                  Formula:{" "}
                  <code className="text-xs bg-base-300 px-1 rounded">
                    (decks needed × EV per deck) − cost of those decks
                  </code>
                </p>
              </div>

              <div className="alert alert-soft alert-info py-2 text-xs">
                <FiHelpCircle className="w-4 h-4 shrink-0" />
                <span>
                  <strong>Which should I look at?</strong> If you plan to sell
                  everything you get (not just the target card), P&amp;L (all
                  drops) is the more realistic number. P&amp;L (card only) is
                  useful for spotting cards that are individually overvalued
                  relative to their rarity.
                </span>
              </div>
            </div>
          </section>

          {/* Batch-independence */}
          <section>
            <h4 className="font-semibold text-base text-base-content mb-2">
              What changes with batch size?
            </h4>
            <div className="overflow-x-auto">
              <table className="table table-xs">
                <thead>
                  <tr>
                    <th>Column / Stat</th>
                    <th>Changes with batch?</th>
                    <th>Why</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-medium">% Chance</td>
                    <td className="text-success">Yes</td>
                    <td>
                      More decks = higher chance of pulling at least one copy
                    </td>
                  </tr>
                  <tr>
                    <td className="font-medium">
                      You Spend / Expected Return / Net Profit
                    </td>
                    <td className="text-success">Yes</td>
                    <td>These scale with how many decks you're opening</td>
                  </tr>
                  <tr>
                    <td className="font-medium">P&amp;L (card only)</td>
                    <td className="text-error">No</td>
                    <td>
                      Based on the expected decks to pull one copy — a fixed
                      number per card regardless of batch
                    </td>
                  </tr>
                  <tr>
                    <td className="font-medium">P&amp;L (all drops)</td>
                    <td className="text-error">No</td>
                    <td>
                      Same reason — uses the same fixed expected deck count
                    </td>
                  </tr>
                  <tr>
                    <td className="font-medium">Break-Even Rate</td>
                    <td className="text-error">No</td>
                    <td>
                      Depends only on card prices and deck cost, not volume
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Break-Even Rate */}
          <section>
            <h4 className="font-semibold text-base text-base-content mb-2">
              Break-Even Rate
            </h4>
            <p>
              The <strong>theoretical minimum exchange rate</strong> (decks per
              divine) at which opening stacked decks is profitable. If you're
              getting more decks per divine than this number on the exchange,
              you're making money on average.
            </p>
            <p className="mt-2">
              This number is <strong>batch-independent</strong> — it only
              depends on the current EV per deck and the chaos-to-divine ratio.
              Changing the batch size or cost model sliders does not affect it.
            </p>
            <p className="mt-1 text-base-content/60">
              Formula:{" "}
              <code className="text-xs bg-base-300 px-1 rounded">
                chaos per divine ÷ EV per deck
              </code>
            </p>
          </section>

          {/* Icons & indicators */}
          <section>
            <h4 className="font-semibold text-base text-base-content mb-2">
              Icons &amp; Indicators
            </h4>
            <div className="overflow-x-auto">
              <table className="table table-xs">
                <thead>
                  <tr>
                    <th className="w-16">Icon</th>
                    <th className="w-36">Name</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <FiAlertTriangle className="w-4 h-4 text-warning" />
                    </td>
                    <td className="font-medium">Low confidence</td>
                    <td>
                      poe.ninja has limited data for this card — the price may
                      be unreliable. This typically happens with very rare cards
                      that trade infrequently. The row is dimmed to indicate
                      lower data quality.
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <span className="badge badge-xs badge-warning">
                        derived
                      </span>
                    </td>
                    <td className="font-medium">Derived rate</td>
                    <td>
                      The bulk exchange volume data was unavailable for this
                      snapshot, so the base rate was calculated from the divine
                      price divided by the stacked deck price. This is a rougher
                      estimate.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Disclaimer */}
          <section>
            <div className="alert alert-soft alert-warning text-xs">
              <FiAlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                All figures are estimates based on poe.ninja market data and
                Prohibited Library card weights. Actual results will vary due to
                RNG, market fluctuations, and exchange liquidity. The sliding
                cost model is an approximation — always check the live exchange
                before committing to large purchases.
              </span>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="modal-action">
          <Button size="sm" variant="primary" onClick={onClose}>
            Got it
          </Button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose}>
          close
        </button>
      </form>
    </dialog>
  );
};

export default PFHelpModal;
