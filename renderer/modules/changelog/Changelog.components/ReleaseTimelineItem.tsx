import type { ChangelogRelease } from "~/main/modules/updater/Updater.api";
import { Badge } from "~/renderer/components";

import {
  changeTypeColor,
  hoverBorderColorClass,
  releaseUrl,
} from "../Changelog.utils";
import ChangelogEntryCard from "./ChangelogEntryCard";

const ReleaseTimelineItem = ({
  release,
  isLast,
  isCurrent,
}: {
  release: ChangelogRelease;
  isLast: boolean;
  isCurrent: boolean;
}) => {
  const color = changeTypeColor(release.changeType);
  const url = releaseUrl(release.version);

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Don't navigate if the user clicked an inner link (commit hash, contributor, etc.)
    if ((e.target as HTMLElement).closest("a")) return;
    window.open(url, "_blank");
  };

  return (
    <li className="relative flex gap-6">
      {/* Timeline line + version badge */}
      <div className="flex flex-col items-center">
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Badge
            variant={color}
            size="md"
            outline
            className="shrink-0 font-mono font-semibold hover:brightness-125 transition-all"
          >
            v{release.version}
          </Badge>
        </a>
        {isCurrent && (
          <Badge
            variant="success"
            size="sm"
            soft
            className="mt-1.5 uppercase text-[10px] tracking-wider"
          >
            current
          </Badge>
        )}
        {!isLast && <div className="w-0.5 grow bg-base-content/10 mt-2" />}
      </div>

      {/* Card content */}
      <div
        role="link"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            window.open(url, "_blank");
          }
        }}
        className={`card bg-base-200 border-2 border-transparent ${hoverBorderColorClass(
          color,
        )} shadow-sm mb-6 flex-1 min-w-0 cursor-pointer transition-all hover:shadow-md hover:brightness-105`}
      >
        <div className="card-body p-5 gap-4">
          {/* Entries */}
          <ul className="space-y-4 divide-y divide-base-content/5">
            {release.entries.map((entry, entryIdx) => (
              <li key={entryIdx}>
                <ChangelogEntryCard entry={entry} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </li>
  );
};

export default ReleaseTimelineItem;
