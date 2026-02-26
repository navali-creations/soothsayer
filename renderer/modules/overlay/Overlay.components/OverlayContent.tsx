import { useBoundStore } from "~/renderer/store";

import { OverlayDropsList } from "./OverlayDropsList";
import { OverlayEmpty } from "./OverlayEmpty";

export const OverlayContent = () => {
  const {
    overlay: { sessionData },
  } = useBoundStore();

  return (
    <div className="relative flex flex-col-reverse overflow-hidden">
      {sessionData.isActive ? <OverlayDropsList /> : <OverlayEmpty />}
    </div>
  );
};
