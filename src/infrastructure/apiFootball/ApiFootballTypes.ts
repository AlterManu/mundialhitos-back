export interface ApiFootballTeamRef {
  id: number;
  name: string;
  logo?: string;
}

export interface ApiFootballPlayerRef {
  id: number | null;
  name: string | null;
}

export interface ApiFootballFixtureEventDto {
  time: {
    elapsed: number | null;
    extra: number | null;
  };
  team: ApiFootballTeamRef;
  player: ApiFootballPlayerRef;
  assist: ApiFootballPlayerRef;
  type: "Goal" | "Card" | "subst" | "Var" | string;
  detail: string | null;
  comments: string | null;
}

export interface ApiFootballFixtureDto {
  fixture: {
    id: number;
    referee: string | null;
    timezone: string;
    date: string;
    timestamp: number;
    status: {
      long: string;
      short: string;
      elapsed: number | null;
    };
  };
  league: {
    id: number;
    name: string;
    season: number;
    round: string | null;
  };
  teams: {
    home: ApiFootballTeamRef & { winner: boolean | null };
    away: ApiFootballTeamRef & { winner: boolean | null };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  events?: ApiFootballFixtureEventDto[];
}

export interface ApiFootballResponse<T> {
  get: string;
  parameters: Record<string, string>;
  errors: Record<string, unknown> | unknown[];
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: T[];
}
