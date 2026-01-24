import { Flex } from "~/renderer/components";

import AppControls from "./AppControls";
import AppTitle from "./AppTitle";
import GameSelector from "./GameSelector/GameSelector";

const AppMenu = () => {
  return (
    <Flex className="drag justify-between items-center px-2 relative z-10 shadow-[160px_0_10px_black] before:content-[''] before:absolute before:bottom-0 before:left-[159px] before:right-0 before:h-px before:bg-base-100">
      <Flex className="gap-2 items-center">
        <AppTitle />
        <GameSelector />
      </Flex>

      <AppControls />
    </Flex>
  );
};

export default AppMenu;
