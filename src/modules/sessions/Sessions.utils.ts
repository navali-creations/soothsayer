export const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
};

export const formatSessionDate = (dateString: string): string => {
  if (!dateString) return "Unknown date";

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    console.error("Invalid date string:", dateString);
    return "Invalid date";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const formatSessionTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const getUniqueLeagues = (sessions: { league: string }[]): string[] => {
  const uniqueLeagues = new Set(sessions.map((s) => s.league));
  return ["all", ...Array.from(uniqueLeagues)];
};
