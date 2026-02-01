import { Flex } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";

import AppControls from "./AppControls";
import AppTitle from "./AppTitle";
import GameSelector from "./GameSelector/GameSelector";

const AppMenu = () => {
  const {
    setup: { setupState },
  } = useBoundStore();

  const isSetupMode = !setupState?.isComplete;

  // In setup mode, shadow starts from 0 (no sidebar)
  // In normal mode, shadow starts from 160px (after sidebar) - title area has no shadow
  const shadowClass = isSetupMode
    ? "shadow-[0_0_10px_black]"
    : "shadow-[160px_0_10px_black]";

  const borderClass = isSetupMode ? "before:left-0" : "before:left-[159px]";

  return (
    <Flex
      className={`drag justify-between items-center px-2 relative z-10 ${shadowClass} before:content-[''] before:absolute before:bottom-0 ${borderClass} before:right-0 before:h-px before:bg-base-100`}
    >
      <Flex className="gap-2 items-center">
        <AppTitle />
        {!isSetupMode && <GameSelector />}
      </Flex>

      <AppControls />
    </Flex>
  );
};

export default AppMenu;
