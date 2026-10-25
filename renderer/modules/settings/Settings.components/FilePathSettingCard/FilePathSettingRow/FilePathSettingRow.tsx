import { FiEye, FiEyeOff, FiFolder } from "react-icons/fi";

import { maskPath } from "~/main/utils/mask-path";
import { Button } from "~/renderer/components";
import Tooltip from "~/renderer/components/Tooltip/Tooltip";

import type { FilePathSetting } from "../../../Settings.types";

const CLIENT_PATH_ANCHORS = ["Path of Exile 2", "Path of Exile", "PoE", "PoE2"];

interface FilePathSettingRowProps {
  setting: FilePathSetting;
  isRevealed: boolean;
  onToggleReveal: (key: string) => void;
}

export function FilePathSettingRow({
  setting,
  isRevealed,
  onToggleReveal,
}: FilePathSettingRowProps) {
  const hasPath = !!setting.value;
  const displayValue =
    hasPath && !isRevealed
      ? maskPath(setting.value!, CLIENT_PATH_ANCHORS)
      : setting.value || "";

  const handleRevealToggle = () => {
    onToggleReveal(setting.key);
  };

  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold text-base-content/80">
          {setting.label}
        </h3>
        <p className="text-xs text-base-content/50">
          Client.txt or KakaoClient.txt location
        </p>
      </div>
      <div className="join w-full">
        <label className="input input-bordered input-sm join-item flex min-w-0 flex-1 items-center">
          <input
            type="text"
            className="min-w-0 flex-1 bg-transparent outline-none"
            value={displayValue}
            readOnly
            placeholder={setting.placeholder}
          />
        </label>
        {hasPath && (
          <Tooltip
            as="button"
            type="button"
            aria-label={isRevealed ? "Hide full path" : "Reveal full path"}
            onClick={handleRevealToggle}
            className="btn btn-ghost btn-sm btn-square join-item text-base-content/50 hover:text-base-content/80"
            content={isRevealed ? "Hide full path" : "Reveal full path"}
          >
            {isRevealed ? (
              <FiEyeOff className="w-4 h-4" />
            ) : (
              <FiEye className="w-4 h-4" />
            )}
          </Tooltip>
        )}
        <Button
          variant="primary"
          size="sm"
          square
          className="join-item"
          onClick={setting.onSelect}
          aria-label={`Select ${setting.label}`}
          tooltip={`Select ${setting.label}`}
        >
          <FiFolder />
        </Button>
      </div>
    </div>
  );
}
