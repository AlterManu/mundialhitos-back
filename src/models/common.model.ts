export interface Fixture {
  id: string;
  referee: string | null;
  timezone: string;
  date: string;
  timestamp: number;
  periods: {
    first: number | null;
    second: number | null;
  };
  venue: {
    id: string | null;
    name: string | null;
    city: string | null;
  };
  status: {
    long: string;
    short: string;
    elapsed: number | null;
  };
}

export interface League {
  id: string;
  name: string;
  country: string;
  logo: string;
  flag: string | null;
  season: number;
  round: string | null;
  standings: boolean;
}

export interface Team {
  id: string;
  name: string;
  logo: string;
  winner: boolean | null;
}

export interface Teams {
  home: Team;
  away: Team;
}

export interface Goals {
  home: number | null;
  away: number | null;
}

export enum MatchEventType {
  Goal = "Goal",
  Card = "Card",
  subst = "subst",
  Var = "Var",
}

export interface MatchEvent {
  time: {
    elapsed: number; // 16
    extra: number | null;
  };
  team: {
    id: string;
    name: string; // "Ecuador"
    logo: string;
  };
  player: {
    id: string;
    name: string; // "E. Valencia"
  };
  assist: {
    id: string | null;
    name: string | null;
  };
  type: MatchEventType;
  detail: string; // "Penalty"
  comments: string | null;
}

export interface Match {
  fixture: Fixture;
  league: League;
  teams: Teams;
  goals: Goals;
  events: MatchEvent[];
}
