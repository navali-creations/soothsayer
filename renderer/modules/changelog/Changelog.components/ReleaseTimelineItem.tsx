import type { ChangelogRelease } from "~/main/modules/updater/Updater.api";
import { Badge } from "~/renderer/components";

import { changeTypeColor } from "../Changelog.utils";
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

  return (
    <li className="relative flex gap-6">
      {/* Timeline line + version badge */}
      <div className="flex flex-col items-center">
        <Badge
          variant={color}
          size="md"
          outline
          className="shrink-0 font-mono font-semibold"
        >
          v{release.version}
        </Badge>
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
      <div className="card bg-base-200 border border-base-300 shadow-sm mb-6 flex-1 min-w-0">
        <div className="card-body p-5 gap-4">
          {/* Entries */}
          <div className="space-y-4 divide-y divide-base-content/5">
            {release.entries.map((entry, entryIdx) => (
              <div key={entryIdx} className={entryIdx > 0 ? "pt-4" : ""}>
                <ChangelogEntryCard entry={entry} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </li>
  );
};

export default ReleaseTimelineItem;
