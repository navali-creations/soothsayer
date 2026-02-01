import { FiCopy, FiMinus, FiSettings, FiSquare, FiX } from "react-icons/fi";
import {
  RiPictureInPictureExitLine,
  RiPictureInPictureLine,
} from "react-icons/ri";

import { Button, Flex, Link } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";

const AppControls = () => {
  const {
    appMenu: { minimize, maximize, unmaximize, close, isMaximized },
    overlay: { toggle: toggleOverlay, isVisible: isOverlayVisible },
    setup: { setupState },
  } = useBoundStore();

  const isSetupMode = !setupState?.isComplete;

  return (
    <Flex className="gap-0">
      {!isSetupMode && (
        <>
          <Button
            onClick={toggleOverlay}
            variant="ghost"
            size="sm"
            title={isOverlayVisible ? "Hide Overlay" : "Show Overlay"}
            data-onboarding="overlay-icon"
          >
            {isOverlayVisible ? (
              <RiPictureInPictureExitLine size={16} />
            ) : (
              <RiPictureInPictureLine size={16} />
            )}
          </Button>
          <Link
            to="/settings"
            asButton
            variant="ghost"
            size="sm"
            className="p-1"
          >
            <FiSettings size={14} />
          </Link>
        </>
      )}
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
        <FiX size={16} />
      </Button>
    </Flex>
  );
};

export default AppControls;
