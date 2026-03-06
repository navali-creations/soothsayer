import type { GameType } from "~/types/data-stores";

import CardDetailsDropTimeline from "./CardDetailsDropTimeline";
import CardDetailsPersonal from "./CardDetailsPersonal";
import CardDetailsSessionList from "./CardDetailsSessionList";
import LoadingOverlay from "./LoadingOverlay";

interface YourDataTabContentProps {
  cardName: string;
  game: GameType;
  isLoading: boolean;
}

/**
 * Content for the "Your Data" tab on the card details page.
 *
 * Renders personal analytics stats, drop timeline chart, and session list,
 * each wrapped in a `LoadingOverlay` that shows a translucent spinner
 * during league switches or analytics refreshes.
 *
 * Extracted from the inline conditional in the page component to keep
 * the page focused on layout and data flow.
 */
const YourDataTabContent = ({
  cardName,
  game,
  isLoading,
}: YourDataTabContentProps) => {
  return (
    <div className="space-y-6">
      {/* Personal analytics stat cards — overlay while loading */}
      <LoadingOverlay isLoading={isLoading}>
        <CardDetailsPersonal />
      </LoadingOverlay>

      {/* Personal drop timeline chart — overlay while loading */}
      <LoadingOverlay isLoading={isLoading}>
        <CardDetailsDropTimeline />
      </LoadingOverlay>

      {/* Sessions list for this card — overlay while loading */}
      <LoadingOverlay isLoading={isLoading}>
        <CardDetailsSessionList cardName={cardName} game={game} />
      </LoadingOverlay>
    </div>
  );
};

export default YourDataTabContent;
