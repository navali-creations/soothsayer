import type { GameType } from "~/types/data-stores";

import CardDetailsDropTimeline from "../CardDetailsDropTimeline";
import CardDetailsPersonal from "../CardDetailsPersonal";
import CardDetailsSessionList from "../CardDetailsSessionList";
import LoadingOverlay from "../LoadingOverlay/LoadingOverlay";

interface YourDataTabContentProps {
  cardName: string;
  game: GameType;
  isLoading: boolean;
}

/** Personal analytics sections for the card details page. */
const YourDataTabContent = ({
  cardName,
  game,
  isLoading,
}: YourDataTabContentProps) => {
  return (
    <div className="space-y-6">
      <LoadingOverlay isLoading={isLoading}>
        <CardDetailsPersonal />
      </LoadingOverlay>

      <LoadingOverlay isLoading={isLoading} className="min-h-64">
        <CardDetailsDropTimeline />
      </LoadingOverlay>

      <div className="min-h-28">
        <CardDetailsSessionList cardName={cardName} game={game} />
      </div>
    </div>
  );
};

export default YourDataTabContent;
