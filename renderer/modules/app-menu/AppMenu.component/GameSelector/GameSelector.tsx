import GameSelectorTab from "./GameSelectorTab/GameSelectorTab";

const GameSelector = () => {
  return (
    <div role="tablist" className="tabs" data-onboarding="game-selector">
      <GameSelectorTab game="poe1" />
      {/*<GameSelectorTab game="poe2" />*/}
    </div>
  );
};

export default GameSelector;
