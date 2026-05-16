import { FiMonitor } from "react-icons/fi";

import { Button } from "~/renderer/components";

interface OverlayRestoreDefaultsRowProps {
  onRestoreDefaults: () => Promise<void> | void;
}

export function OverlayRestoreDefaultsRow({
  onRestoreDefaults,
}: OverlayRestoreDefaultsRowProps) {
  return (
    <div className="flex items-center justify-between lg:col-span-2">
      <div className="flex items-center gap-3">
        <FiMonitor className="w-4 h-4 text-base-content/70 shrink-0" />
        <div>
          <span className="text-sm text-base-content/70">Restore defaults</span>
          <p className="text-xs text-base-content/40">
            Reset position, size, and font sizes to defaults
          </p>
        </div>
      </div>
      <Button size="sm" outline onClick={onRestoreDefaults} className="gap-1.5">
        Restore defaults
      </Button>
    </div>
  );
}
