/**
 * Format an ISO timestamp as a human-readable relative time + absolute date.
 * e.g. "3 months ago · Dec 15, 2025"
 */
export function formatRelativeDate(isoString: string): {
  relative: string;
  absolute: string;
} {
  const date = new Date(isoString);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  let relative: string;
  if (diffMins < 1) {
    relative = "just now";
  } else if (diffMins < 60) {
    relative = `${diffMins}m ago`;
  } else if (diffHours < 24) {
    relative = `${diffHours}h ago`;
  } else if (diffDays < 30) {
    relative = `${diffDays}d ago`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    relative = `${months} month${months !== 1 ? "s" : ""} ago`;
  } else {
    const years = Math.floor(diffDays / 365);
    relative = `${years} year${years !== 1 ? "s" : ""} ago`;
  }

  const absolute = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return { relative, absolute };
}

// Re-export from the canonical shared location so card-details consumers
// can import from the helpers barrel without cross-module awareness.
export { formatRelativeTime } from "~/renderer/utils";
