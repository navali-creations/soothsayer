import { FiGitCommit, FiUser } from "react-icons/fi";

import type { ChangelogEntry } from "~/main/modules/updater/Updater.api";
import { Badge, MarkdownRenderer } from "~/renderer/components";

import ChangelogContent from "./ChangelogContent";

const ChangelogEntryCard = ({ entry }: { entry: ChangelogEntry }) => {
  return (
    <div className="space-y-3">
      {entry.description && (
        <MarkdownRenderer>{entry.description}</MarkdownRenderer>
      )}

      {entry.content && <ChangelogContent content={entry.content} />}

      {entry.subItems && entry.subItems.length > 0 && (
        <MarkdownRenderer>
          {entry.subItems.map((item) => `- ${item}`).join("\n")}
        </MarkdownRenderer>
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
