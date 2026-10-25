import Tooltip from "~/renderer/components/Tooltip/Tooltip";
import { useSetup } from "~/renderer/store";
import type { GameType } from "~/types/data-stores";

const SetupGameStep = () => {
  const { setupState, toggleGame } = useSetup();

  const selectedGames = setupState?.selectedGames || [];

  const games: Array<{ value: GameType; label: string; description: string }> =
    [
      {
        value: "poe1",
        label: "Path of Exile 1",
        description: "The original Path of Exile",
      },
      {
        value: "poe2",
        label: "Path of Exile 2",
        description: "The new standalone sequel",
      },
    ];

  const isSelected = (game: GameType) => selectedGames.includes(game);

  const handleToggle = (game: GameType) => {
    toggleGame(game);
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-base-content mb-1">
        Which games do you play?
      </h2>
      <p className="text-sm text-base-content/60 mb-4">
        Select one or both games. You can change this later in settings.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {games.map((game) => {
          const selected = isSelected(game.value);
          const isOnlySelected = selected && selectedGames.length === 1;

          return (
            <Tooltip
              key={game.value}
              as="div"
              className="block"
              content="At least one game must be selected"
              describeChild
              disableTooltip={!isOnlySelected}
            >
              <button
                onClick={() => handleToggle(game.value)}
                disabled={isOnlySelected}
                className={`w-full h-full p-4 rounded-lg border-2 transition-all text-left relative ${
                  selected
                    ? "border-primary bg-primary/10"
                    : "border-base-100 hover:border-base-content/30"
                } ${isOnlySelected ? "cursor-not-allowed" : "cursor-pointer"}`}
              >
                {/* Checkbox indicator */}
                <div
                  className={`absolute top-3 right-3 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    selected
                      ? "border-primary bg-primary"
                      : "border-base-content/30 bg-base-100"
                  }`}
                >
                  {selected && (
                    <svg
                      className="w-3 h-3 text-primary-content"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>

                <div className="text-base-content font-semibold pr-6">
                  {game.label}
                </div>
                <div className="text-base-content/60 text-xs mt-0.5">
                  {game.description}
                </div>
              </button>
            </Tooltip>
          );
        })}
      </div>

      {selectedGames.length === 2 && (
        <p className="text-xs text-base-content/50 mt-3">
          <span className="font-medium text-base-content/70">
            Playing both?
          </span>{" "}
          You'll configure leagues and client paths for each game.
        </p>
      )}
    </div>
  );
};

export default SetupGameStep;
