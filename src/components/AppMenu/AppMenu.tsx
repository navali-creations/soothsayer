import {
  FiCopy,
  FiMinus,
  FiSettings,
  FiSquare,
  FiX,
  FiRadio,
  FiCheck as Icon,
} from "react-icons/fi";
import { useAppControls } from "../../hooks";
import { Button, Flex, Link } from "..";
import pkgJson from "../../../package.json" with { type: "json" };

const AppMenu = () => {
  const { minimize, maximize, unmaximize, close, isMaximized } =
    useAppControls();

  return (
    <Flex className="drag justify-between items-center px-2 bg-base-200 ">
      <Flex className="gap-1 items-center">
        <p className="font-bold select-none">soothsayer</p>
        <div className="badge badge-soft badge-sm mt-0.5">
          v{pkgJson.version}
        </div>
      </Flex>

      <Flex className="gap-0">
        <Link to="/settings" asButton variant="ghost" size="sm">
          <FiSettings />
        </Link>
        <Button onClick={minimize} variant="ghost" size="sm">
          <FiMinus />
        </Button>
        {isMaximized ? (
          <Button onClick={unmaximize} variant="ghost" size="sm">
            <FiCopy className="scale-x-[-1]" />
          </Button>
        ) : (
          <Button onClick={maximize} variant="ghost" size="sm">
            <FiSquare />
          </Button>
        )}
        <Button onClick={close} variant="ghost" size="sm">
          <FiX />
        </Button>
      </Flex>
    </Flex>
  );
};

export default AppMenu;
