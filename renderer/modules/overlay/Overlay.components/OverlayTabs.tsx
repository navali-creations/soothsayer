import clsx from "clsx";

import { useBoundStore } from "~/renderer/store";

import { OverlayActionButtons } from "./OverlayActionButtons";
import { OverlayTabBar } from "./OverlayTabBar";

export const OverlayTabs = () => {
  const {
    overlay: { isLeftHalf },
  } = useBoundStore();

  return (
    <div
      className={clsx(
        "relative z-200 flex items-center px-2 h-full",
        isLeftHalf
          ? "justify-start bg-linear-to-l from-transparent to-base-300"
          : "justify-end bg-linear-to-r from-transparent to-base-300",
      )}
      style={
        {
          zoom: `var(--overlay-toolbar-font-size, 1)`,
        } as React.CSSProperties
      }
    >
      {isLeftHalf ? (
        <>
          <OverlayActionButtons />
          <OverlayTabBar />
        </>
      ) : (
        <>
          <OverlayTabBar />
          <OverlayActionButtons />
        </>
      )}
    </div>
  );
};
