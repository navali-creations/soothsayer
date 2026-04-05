import { useOverlay } from "~/renderer/store";

import { OverlayDropsList } from "./OverlayDropsList/OverlayDropsList";
import { OverlayEmpty } from "./OverlayEmpty";

export const OverlayContent = () => {
  const { sessionData } = useOverlay();

  return (
    <div
      className="relative flex flex-col-reverse overflow-hidden"
      style={
        {
          zoom: "var(--overlay-font-size, 1)",
        } as React.CSSProperties
      }
    >
      {sessionData.isActive ? <OverlayDropsList /> : <OverlayEmpty />}
    </div>
  );
};
