import { Flex } from "../../../components";
import AppControls from "./components/AppControls";
import AppTitle from "./components/AppTitle";
import GameSelector from "./components/GameSelector/GameSelector";

const AppMenu = () => {
  return (
    <Flex className="drag justify-between items-center px-2 bg-base-200 border-b divider-color ">
      <Flex className="gap-2 items-center">
        <AppTitle />
        <div className="h-6 w-px bg-base-content/20" />
        <GameSelector />
      </Flex>

      <AppControls />
    </Flex>
  );
};

export default AppMenu;
