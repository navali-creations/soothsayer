import { FiCopy, FiMinus, FiSettings, FiSquare, FiX } from "react-icons/fi";
import { IoNewspaperOutline } from "react-icons/io5";
import { MdOutlineNewReleases } from "react-icons/md";
import {
  RiPictureInPictureExitLine,
  RiPictureInPictureLine,
} from "react-icons/ri";
import { RxCaretDown } from "react-icons/rx";
import { VscFeedback } from "react-icons/vsc";

import { Button, Dropdown, Flex, Link } from "~/renderer/components";
import UpdateIndicator from "~/renderer/modules/updater/UpdateIndicator";
import { useBoundStore } from "~/renderer/store";

import WhatsNewModal from "./WhatsNewModal";

const DISCORD_URL = "https://discord.gg/yxuBrPY";

const AppControls = () => {
  const {
    appMenu: {
      minimize,
      maximize,
      unmaximize,
      close,
      isMaximized,
      openWhatsNew,
    },
    overlay: { toggle: toggleOverlay, isVisible: isOverlayVisible },
    setup: { setupState },
  } = useBoundStore();

  const isSetupMode = !setupState?.isComplete;

  return (
    <Flex className="gap-0">
      {!isSetupMode && (
        <>
          <UpdateIndicator />
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
          <Dropdown
            trigger={<RxCaretDown size={18} />}
            className="btn btn-ghost btn-sm"
            position="dropdown-end"
            width="w-[180px]"
          >
            <li>
              <Link
                to="/settings"
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-base-300 transition-colors no-drag"
              >
                <FiSettings size={14} className="text-base-content/60" />
                <span className="text-sm">Settings</span>
              </Link>
            </li>

            <div className="divider my-1 px-2" />

            <li>
              <button
                type="button"
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-base-300 transition-colors w-full text-left no-drag"
                onClick={() => openWhatsNew()}
              >
                <MdOutlineNewReleases
                  size={15}
                  className="text-base-content/60"
                />
                <span className="text-sm">What&apos;s New</span>
              </button>
            </li>
            <li>
              <Link
                to="/changelog"
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-base-300 transition-colors no-drag"
              >
                <IoNewspaperOutline
                  size={14}
                  className="text-base-content/60"
                />
                <span className="text-sm">Changelog</span>
              </Link>
            </li>

            <div className="divider my-1 px-2" />

            <li>
              <a
                href={DISCORD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-base-300 transition-colors no-drag"
              >
                <VscFeedback size={14} className="text-base-content/60" />
                <span className="text-sm">Feedback</span>
              </a>
            </li>
          </Dropdown>
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

      <WhatsNewModal />
    </Flex>
  );
};

export default AppControls;
