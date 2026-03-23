import { useBoundStore } from "~/renderer/store";
import type { GameType } from "~/types/data-stores";

const SetupGameStep = () => {
  const {
    setup: { setupState, toggleGame },
  } = useBoundStore();

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
            <button
              key={game.value}
              onClick={() => handleToggle(game.value)}
              disabled={isOnlySelected}
              className={`p-4 rounded-lg border-2 transition-all text-left relative ${
                selected
                  ? "border-primary bg-primary/10"
                  : "border-base-100 hover:border-base-content/30"
              } ${isOnlySelected ? "cursor-not-allowed" : "cursor-pointer"}`}
              title={
                isOnlySelected
                  ? "At least one game must be selected"
                  : undefined
              }
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
