import { useState } from "react";
import { FiHelpCircle } from "react-icons/fi";

import { Button, Search } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";

import PFHelpModal from "./PFHelpModal";

interface PFHeaderActionsProps {
  onGlobalFilterChange: (value: string) => void;
}

const PFHeaderActions = ({ onGlobalFilterChange }: PFHeaderActionsProps) => {
  const [helpOpen, setHelpOpen] = useState(false);

  const {
    poeNinja: { isRefreshing },
    profitForecast: { isLoading, isComputing },
  } = useBoundStore();

  const controlsDisabled = isRefreshing || isLoading;

  return (
    <div className="flex items-center gap-3">
      {/* Help modal */}
      <PFHelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* Help button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setHelpOpen(true)}
        className="gap-1"
      >
        <FiHelpCircle className="w-4 h-4" />
      </Button>

      {/* Search input */}
      <Search
        onChange={onGlobalFilterChange}
        debounceMs={300}
        placeholder="Search cards..."
        size="sm"
        className="flex-1 w-[150px]"
        disabled={controlsDisabled || isComputing}
      />
    </div>
  );
};

export default PFHeaderActions;
