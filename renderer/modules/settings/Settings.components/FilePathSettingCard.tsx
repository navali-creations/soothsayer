import { useCallback, useState } from "react";
import { FiEye, FiEyeOff, FiFolder } from "react-icons/fi";

import { maskPath } from "~/main/utils/mask-path";
import { Button, Flex } from "~/renderer/components";

import type { FilePathCategory } from "../Settings.types";

/** Anchors for masking PoE client log paths. */
const CLIENT_PATH_ANCHORS = ["Path of Exile 2", "Path of Exile", "PoE", "PoE2"];

interface FilePathSettingCardProps {
  category: FilePathCategory;
}

const FilePathSettingCard = ({ category }: FilePathSettingCardProps) => {
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());

  const toggleReveal = useCallback((key: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">{category.title}</h2>
        <p className="text-sm text-base-content/60">{category.description}</p>

        <div className="space-y-4 mt-4">
          {category.settings.map((setting) => {
            const hasPath = !!setting.value;
            const isRevealed = revealedKeys.has(setting.key);
            const displayValue =
              hasPath && !isRevealed
                ? maskPath(setting.value!, CLIENT_PATH_ANCHORS)
                : setting.value || "";

            return (
              <div key={setting.key} className="form-control w-full">
                <label className="label">
                  <span className="label-text">{setting.label}</span>
                </label>
                <Flex className="gap-2">
                  <input
                    type="text"
                    className="input input-bordered input-sm flex-1"
                    value={displayValue}
                    readOnly
                    placeholder={setting.placeholder}
                  />
                  {hasPath && (
                    <button
                      type="button"
                      onClick={() => toggleReveal(setting.key)}
                      className="btn btn-ghost btn-sm btn-square text-base-content/50 hover:text-base-content/80"
                      title={isRevealed ? "Hide full path" : "Reveal full path"}
                    >
                      {isRevealed ? (
                        <FiEyeOff className="w-4 h-4" />
                      ) : (
                        <FiEye className="w-4 h-4" />
                      )}
                    </button>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={setting.onSelect}
                  >
                    <FiFolder />
                  </Button>
                </Flex>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FilePathSettingCard;
