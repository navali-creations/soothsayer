import GameSelectorTab from "./GameSelectorTab";

const GameSelector = () => {
  return (
    <div role="tablist" className="tabs tabs-border">
      <GameSelectorTab game="poe1" />
      <GameSelectorTab game="poe2" />
    </div>
  );
};

export default GameSelector;
