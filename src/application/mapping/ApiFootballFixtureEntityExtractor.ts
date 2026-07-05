import { ApiFootballFixtureDto } from "@/infrastructure/apiFootball/ApiFootballTypes";

export interface ApiFootballTeamCandidate {
  id: number;
  name: string;
}

export interface ApiFootballVenueCandidate {
  id: number | null;
  name: string | null;
  city: string | null;
}

export interface ApiFootballPlayerCandidate {
  id: number;
  name: string;
  aliases: string[];
  apiTeamId: number | null;
  number: number | null;
  position: string | null;
  source: "event" | "lineup" | "player_stats";
}

export interface ApiFootballFixtureEntities {
  teams: ApiFootballTeamCandidate[];
  venue: ApiFootballVenueCandidate;
  players: ApiFootballPlayerCandidate[];
}

export function extractFixtureEntities(
  fixture: ApiFootballFixtureDto,
): ApiFootballFixtureEntities {
  return {
    teams: [
      { id: fixture.teams.home.id, name: fixture.teams.home.name },
      { id: fixture.teams.away.id, name: fixture.teams.away.name },
    ],
    venue: {
      id: fixture.fixture.venue.id,
      name: fixture.fixture.venue.name,
      city: fixture.fixture.venue.city,
    },
    players: extractApiPlayers(fixture),
  };
}

export function extractApiPlayers(
  fixture: ApiFootballFixtureDto,
): ApiFootballPlayerCandidate[] {
  const players = new Map<number, ApiFootballPlayerCandidate>();

  for (const event of fixture.events ?? []) {
    addApiPlayer(players, {
      id: event.player.id,
      name: event.player.name,
      apiTeamId: event.team.id,
      number: null,
      position: null,
      source: "event",
    });
    addApiPlayer(players, {
      id: event.assist.id,
      name: event.assist.name,
      apiTeamId: event.team.id,
      number: null,
      position: null,
      source: "event",
    });
  }

  for (const lineup of (fixture.lineups ?? []) as unknown[]) {
    const team = getObject(lineup, "team");
    const apiTeamId = getNumber(team, "id");

    for (const section of ["startXI", "substitutes"]) {
      const lineupPlayers = getObjectArray(lineup, section);
      for (const item of lineupPlayers) {
        const player = getObject(item, "player");
        addApiPlayer(players, {
          id: getNumber(player, "id"),
          name: getString(player, "name"),
          apiTeamId,
          number: getNumber(player, "number"),
          position: getString(player, "pos"),
          source: "lineup",
        });
      }
    }
  }

  for (const teamPlayers of (fixture.players ?? []) as unknown[]) {
    const team = getObject(teamPlayers, "team");
    const apiTeamId = getNumber(team, "id");
    const responsePlayers = getObjectArray(teamPlayers, "players");

    for (const item of responsePlayers) {
      const player = getObject(item, "player");
      addApiPlayer(players, {
        id: getNumber(player, "id"),
        name: getString(player, "name"),
        apiTeamId,
        number: null,
        position: null,
        source: "player_stats",
      });
    }
  }

  return [...players.values()];
}

function addApiPlayer(
  players: Map<number, ApiFootballPlayerCandidate>,
  candidate: {
    id: number | null;
    name: string | null;
    apiTeamId: number | null;
    number: number | null;
    position: string | null;
    source: ApiFootballPlayerCandidate["source"];
  },
) {
  if (candidate.id === null || !candidate.name) return;

  const existing = players.get(candidate.id);
  if (!existing) {
    players.set(candidate.id, {
      id: candidate.id,
      name: candidate.name,
      aliases: [candidate.name],
      apiTeamId: candidate.apiTeamId,
      number: candidate.number,
      position: candidate.position,
      source: candidate.source,
    });
    return;
  }

  players.set(candidate.id, {
    ...existing,
    name: chooseBestApiPlayerName(existing.name, candidate.name),
    aliases: mergeAliases(existing.aliases, candidate.name),
    apiTeamId: existing.apiTeamId ?? candidate.apiTeamId,
    number: existing.number ?? candidate.number,
    position: existing.position ?? candidate.position,
    source: existing.source === "lineup" ? existing.source : candidate.source,
  });
}

function chooseBestApiPlayerName(current: string, incoming: string): string {
  const currentScore = apiPlayerNameQuality(current);
  const incomingScore = apiPlayerNameQuality(incoming);
  if (incomingScore > currentScore) return incoming;
  if (incomingScore < currentScore) return current;
  return incoming.length > current.length ? incoming : current;
}

function apiPlayerNameQuality(value: string): number {
  const tokens = value.replace(/\./g, " ").split(/\s+/).filter(Boolean);
  const firstToken = tokens[0] ?? "";
  const hasFullFirstName = firstToken.length > 1;

  return tokens.length * 10 + (hasFullFirstName ? 10 : 0) + value.length / 100;
}

function mergeAliases(aliases: string[], incoming: string): string[] {
  const normalizedIncoming = incoming.trim();
  if (!normalizedIncoming) return aliases;
  if (aliases.some((alias) => alias.trim() === normalizedIncoming)) return aliases;
  return [...aliases, normalizedIncoming];
}

function getObject(value: unknown, key: string): Record<string, unknown> {
  if (!isRecord(value)) return {};
  const item = value[key];
  return isRecord(item) ? item : {};
}

function getObjectArray(value: unknown, key: string): unknown[] {
  if (!isRecord(value)) return [];
  const item = value[key];
  return Array.isArray(item) ? item : [];
}

function getNumber(value: Record<string, unknown>, key: string): number | null {
  const item = value[key];
  return typeof item === "number" ? item : null;
}

function getString(value: Record<string, unknown>, key: string): string | null {
  const item = value[key];
  return typeof item === "string" ? item : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
