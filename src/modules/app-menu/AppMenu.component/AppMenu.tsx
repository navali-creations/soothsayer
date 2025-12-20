import { Flex } from "../../../components";
import AppControls from "./components/AppControls";
import AppTitle from "./components/AppTitle";
import GameSelector from "./components/GameSelector/GameSelector";

const AppMenu = () => {
  return (
    <Flex className="drag justify-between items-center px-2 bg-base-200">
      <Flex className="gap-2 items-center">
        <AppTitle />
        <div className="h-6 w-px" />
        <GameSelector />
      </Flex>

      <AppControls />
    </Flex>
  );
};

export default AppMenu;
