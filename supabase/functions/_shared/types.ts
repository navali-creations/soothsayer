export interface League {
  id: string;
  game: "poe1" | "poe2";
  league_id: string;
  name: string;
  start_at: string | null;
  end_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Snapshot {
  id: string;
  league_id: string;
  fetched_at: string;
  exchange_chaos_to_divine: number;
  stash_chaos_to_divine: number;
  created_at: string;
}

export interface CardPrice {
  id: string;
  snapshot_id: string;
  card_name: string;
  price_source: "exchange" | "stash";
  chaos_value: number;
  divine_value: number;
  stack_size: number | null;
}

export interface PoeNinjaExchangeResponse {
  core: {
    rates: {
      divine: number;
    };
  };
  items: Array<{
    id: number;
    name: string;
    category: string;
  }>;
  lines: Array<{
    primaryValue: number;
  }>;
}

export interface PoeNinjaStashResponse {
  lines: Array<{
    id: number;
    name: string;
    chaosValue: number;
    divineValue: number;
    stackSize: number;
  }>;
}
