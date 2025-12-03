export interface PoeLeagueRule {
  id: string;
  name: string;
  description: string;
}

export interface PoeLeagueCategory {
  id: string;
  current?: boolean;
}

export interface PoeLeagueFullData {
  id: string;
  name: string;
  realm: string;
  url: string;
  startAt: string | null;
  endAt: string | null;
  description: string;
  category: PoeLeagueCategory;
  registerAt?: string;
  delveEvent?: boolean;
  rules: PoeLeagueRule[];
}

export interface PoeLeague {
  id: string;
  name: string;
  startAt: string | null;
  endAt: string | null;
}
