import { useNavigate } from "@tanstack/react-router";

import { Stat } from "~/renderer/components";

import type { MostDecksOpenedHighlight } from "../../../Statistics.types";

interface StatsMostDecksOpenedProps {
  data: MostDecksOpenedHighlight | null;
}

export const StatsMostDecksOpened = ({ data }: StatsMostDecksOpenedProps) => {
  const navigate = useNavigate();

  const formattedCount = data ? data.totalDecksOpened.toLocaleString() : "N/A";

  const handleClick = () => {
    if (data) {
      navigate({
        to: "/sessions/$sessionId",
        params: { sessionId: data.sessionId },
      });
    }
  };

  return (
    <Stat
      className={`flex-1 basis-1/4 min-w-0 relative ${
        data ? "cursor-pointer hover:bg-base-200 transition-colors" : ""
      }`}
      onClick={handleClick}
      role={data ? "link" : undefined}
    >
      {data && (
        <span className="absolute bottom-1.5 right-2 text-[10px] text-base-content/25 pointer-events-none select-none">
          Click to view details
        </span>
      )}
      <Stat.Title>Most Decks Opened</Stat.Title>
      <Stat.Value className="text-lg tabular-nums">{formattedCount}</Stat.Value>
      <Stat.Desc>{!data && <span>No sessions yet</span>}</Stat.Desc>
    </Stat>
  );
};
