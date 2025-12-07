import { FiCopy, FiMinus, FiSettings, FiSquare, FiX } from "react-icons/fi";
import { Button, Flex, Link } from "../../../../components";
import { useBoundStore } from "../../../../store/store";

const AppControls = () => {
  const {
    appMenu: { minimize, maximize, unmaximize, close, isMaximized },
  } = useBoundStore();

  return (
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
  );
};

export default AppControls;
