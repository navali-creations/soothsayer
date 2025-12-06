import { useNavigate, useRouterState } from "@tanstack/react-router";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { FiCopy, FiMinus, FiSettings, FiSquare, FiX } from "react-icons/fi";
import pkgJson from "../../../package.json" with { type: "json" };
import { useAppControls, usePoeProcess } from "../../hooks";
import { Button, Flex, Link } from "..";

type GameType = "poe1" | "poe2";

const AppMenu = () => {
  const { minimize, maximize, unmaximize, close, isMaximized } =
    useAppControls();
  const { isRunning: isPoe1Running } = usePoeProcess();
  const navigate = useNavigate();
  const routerState = useRouterState();

  // TODO: Add separate PoE2 process detection when available
  const isPoe2Running = false;

  // Determine current game from route
  const [currentGame, setCurrentGame] = useState<GameType>("poe1");

  useEffect(() => {
    const path = routerState.location.pathname;
    if (path.startsWith("/poe2")) {
      setCurrentGame("poe2");
    } else {
      setCurrentGame("poe1");
    }
  }, [routerState.location.pathname]);

  const handleGameSwitch = (game: GameType) => {
    if (game === currentGame) return;

    setCurrentGame(game);

    // Map current route to the new game's equivalent
    const currentPath = routerState.location.pathname;
    let newPath = `/${game}`;

    // Map routes between games
    if (currentPath.includes("current-session")) {
      newPath = `/${game}/current-session`;
    } else if (currentPath.includes("sessions")) {
      newPath = `/${game}/sessions`;
    } else if (currentPath.includes("stats")) {
      newPath = `/${game}/stats`;
    }

    navigate({ to: newPath });
  };

  return (
    <Flex className="drag justify-between items-center px-2 bg-base-200">
      <Flex className="gap-2 items-center">
        <p className="font-bold select-none">soothsayer</p>
        <div className="badge badge-soft badge-sm mt-0.5">
          v{pkgJson.version}
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-base-content/20" />

        {/* PoE 1/2 Tabs */}
        <Flex className="gap-1 no-drag">
          <button
            onClick={() => handleGameSwitch("poe1")}
            className={clsx(
              "px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer hover:bg-base-300/50",
              currentGame === "poe1"
                ? isPoe1Running
                  ? "bg-success/20 text-success ring-1 ring-success/30"
                  : "bg-primary/20 text-primary ring-1 ring-primary/30"
                : isPoe1Running
                  ? "bg-success/10 text-success/70"
                  : "bg-base-300 text-base-content/50",
            )}
          >
            <div
              className={clsx(
                "w-1.5 h-1.5 rounded-full transition-all",
                isPoe1Running
                  ? "bg-success shadow-[0_0_4px_rgba(34,197,94,0.5)]"
                  : "bg-base-content/30",
              )}
            />
            <span>PoE 1</span>
          </button>

          <button
            onClick={() => handleGameSwitch("poe2")}
            className={clsx(
              "px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer hover:bg-base-300/50",
              currentGame === "poe2"
                ? isPoe2Running
                  ? "bg-success/20 text-success ring-1 ring-success/30"
                  : "bg-primary/20 text-primary ring-1 ring-primary/30"
                : isPoe2Running
                  ? "bg-success/10 text-success/70"
                  : "bg-base-300 text-base-content/50",
            )}
          >
            <div
              className={clsx(
                "w-1.5 h-1.5 rounded-full transition-all",
                isPoe2Running
                  ? "bg-success shadow-[0_0_4px_rgba(34,197,94,0.5)]"
                  : "bg-base-content/30",
              )}
            />
            <span>PoE 2</span>
          </button>
        </Flex>
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
