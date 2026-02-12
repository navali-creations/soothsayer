import { FiGitCommit, FiUser } from "react-icons/fi";

import type { ChangelogEntry } from "~/main/modules/updater/Updater.api";
import { Badge } from "~/renderer/components";

const ChangelogEntryCard = ({ entry }: { entry: ChangelogEntry }) => {
  // Strip bold markdown markers for cleaner display
  const cleanDescription = entry.description.replace(/\*\*([^*]+)\*\*/g, "$1");

  return (
    <div className="space-y-3">
      <p className="text-sm text-base-content/80 leading-relaxed">
        {cleanDescription}
      </p>

      {entry.subItems && entry.subItems.length > 0 && (
        <ul className="space-y-1.5 ml-1">
          {entry.subItems.map((item, idx) => {
            const cleanItem = item.replace(/\*\*([^*]+)\*\*/g, "$1");
            // Split on the first colon to get the label vs description
            const colonIdx = cleanItem.indexOf(":");
            const hasLabel = colonIdx > 0 && colonIdx < 50;

            return (
              <li
                key={idx}
                className="flex items-start gap-2 text-sm text-base-content/70"
              >
                <span className="text-primary mt-1.5 shrink-0">•</span>
                {hasLabel ? (
                  <span>
                    <span className="font-medium text-base-content/90">
                      {cleanItem.slice(0, colonIdx)}:
                    </span>
                    {cleanItem.slice(colonIdx + 1)}
                  </span>
                ) : (
                  <span>{cleanItem}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {(entry.commitHash || entry.contributor) && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {entry.commitHash && (
            <Badge
              variant="info"
              size="sm"
              soft
              icon={<FiGitCommit size={11} />}
            >
              {entry.commitUrl ? (
                <a
                  href={entry.commitUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {entry.commitHash.slice(0, 7)}
                </a>
              ) : (
                entry.commitHash.slice(0, 7)
              )}
            </Badge>
          )}
          {entry.contributor && (
            <Badge variant="info" size="sm" soft icon={<FiUser size={11} />}>
              {entry.contributorUrl ? (
                <a
                  href={entry.contributorUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  @{entry.contributor}
                </a>
              ) : (
                `@${entry.contributor}`
              )}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};

export default ChangelogEntryCard;
