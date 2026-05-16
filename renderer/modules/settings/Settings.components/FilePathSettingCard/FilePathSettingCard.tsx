import { useCallback, useState } from "react";

import type { FilePathCategory } from "../../Settings.types";
import { FilePathSettingRow } from "./FilePathSettingRow/FilePathSettingRow";

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
    <section className="space-y-3">
      <p className="sr-only">{category.description}</p>

      <div className="grid gap-4">
        {category.settings.map((setting) => {
          const isRevealed = revealedKeys.has(setting.key);

          return (
            <FilePathSettingRow
              key={setting.key}
              setting={setting}
              isRevealed={isRevealed}
              onToggleReveal={toggleReveal}
            />
          );
        })}
      </div>
    </section>
  );
};

export default FilePathSettingCard;
