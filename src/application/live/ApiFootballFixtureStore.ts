import { DataSource, Repository } from "typeorm";
import { ApiFootballFixture as ApiFootballFixtureEntity } from "@/entities/ApiFootballFixture";
import {
  ExternalIdMapping,
  ExternalProvider,
  MappedEntityType,
} from "@/entities/ExternalIdMapping";
import { Player } from "@/entities/Player";
import { Team } from "@/entities/Team";
import { ApiFootballFixtureDto } from "@/infrastructure/apiFootball/ApiFootballTypes";

export class ApiFootballFixtureStore {
  private readonly fixtureRepo: Repository<ApiFootballFixtureEntity>;
  private readonly mappingRepo: Repository<ExternalIdMapping>;
  private readonly playerRepo: Repository<Player>;
  private readonly teamRepo: Repository<Team>;

  constructor(private readonly dataSource: DataSource) {
    this.fixtureRepo = dataSource.getRepository(ApiFootballFixtureEntity);
    this.mappingRepo = dataSource.getRepository(ExternalIdMapping);
    this.playerRepo = dataSource.getRepository(Player);
    this.teamRepo = dataSource.getRepository(Team);
  }

  async upsertFixtures(fixtures: ApiFootballFixtureDto[]) {
    const saved: ApiFootballFixtureEntity[] = [];

    for (const fixture of fixtures) {
      saved.push(await this.upsertFixture(fixture));
    }

    return saved;
  }

  async upsertFixture(fixture: ApiFootballFixtureDto) {
    const internalMatchId = buildInternalMatchId(fixture);
    const homeLocalTeamId = await this.resolveTeam(
      fixture.teams.home.id,
      fixture.teams.home.name,
    );
    const awayLocalTeamId = await this.resolveTeam(
      fixture.teams.away.id,
      fixture.teams.away.name,
    );

    await this.upsertMapping(
      MappedEntityType.Match,
      fixture.fixture.id,
      internalMatchId,
      {
        leagueId: fixture.league.id,
        season: fixture.league.season,
        round: fixture.league.round,
      },
    );

    const entity = this.fixtureRepo.create({
      internal_match_id: internalMatchId,
      api_fixture_id: String(fixture.fixture.id),
      league_id: fixture.league.id,
      season: fixture.league.season,
      round: fixture.league.round,
      kickoff_at: fixture.fixture.date,
      venue_name: fixture.fixture.venue.name,
      venue_city: fixture.fixture.venue.city,
      status_long: fixture.fixture.status.long,
      status_short: fixture.fixture.status.short,
      elapsed: fixture.fixture.status.elapsed,
      home_api_team_id: String(fixture.teams.home.id),
      home_team_name: fixture.teams.home.name,
      home_local_team_id: homeLocalTeamId,
      away_api_team_id: String(fixture.teams.away.id),
      away_team_name: fixture.teams.away.name,
      away_local_team_id: awayLocalTeamId,
      home_goals: fixture.goals.home,
      home_winner: fixture.teams.home.winner,
      away_goals: fixture.goals.away,
      away_winner: fixture.teams.away.winner,
      score: (fixture.score ?? {}) as Record<string, unknown>,
      raw_fixture: fixture as unknown as Record<string, unknown>,
    });

    const saved = await this.fixtureRepo.save(entity);
    await this.upsertPlayerMappingsFromFixture(fixture);
    return saved;
  }

  private async resolveTeam(
    apiTeamId: number,
    teamName: string,
  ): Promise<string | null> {
    const existing = await this.mappingRepo.findOneBy({
      provider: ExternalProvider.ApiFootball,
      entity_type: MappedEntityType.Team,
      external_id: String(apiTeamId),
    });
    if (existing) return existing.local_id;

    const team = await this.teamRepo
      .createQueryBuilder("team")
      .where("LOWER(team.name_en) = LOWER(:teamName)", { teamName })
      .getOne();

    if (!team) return null;

    await this.upsertMapping(MappedEntityType.Team, apiTeamId, team.team_id, {
      apiName: teamName,
      localName: team.name_en,
    });

    return team.team_id;
  }

  private async upsertMapping(
    entityType: MappedEntityType,
    externalId: number | string,
    localId: string,
    metadata: Record<string, unknown>,
  ) {
    const existing = await this.mappingRepo.findOneBy({
      provider: ExternalProvider.ApiFootball,
      entity_type: entityType,
      external_id: String(externalId),
    });

    const mapping =
      existing ??
      this.mappingRepo.create({
        provider: ExternalProvider.ApiFootball,
        entity_type: entityType,
        external_id: String(externalId),
      });

    mapping.local_id = localId;
    mapping.metadata = metadata;
    await this.mappingRepo.save(mapping);
  }

  private async upsertPlayerMappingsFromFixture(fixture: ApiFootballFixtureDto) {
    const apiPlayers = extractApiPlayers(fixture);
    if (apiPlayers.length === 0) return;

    const localPlayers = await this.playerRepo.find();
    const exactNameIndex = new Map<string, Player[]>();
    const abbreviatedNameIndex = new Map<string, Player[]>();

    for (const player of localPlayers) {
      const fullName = normalizeName(
        `${player.name ?? ""} ${player.lastname ?? ""}`,
      );
      if (fullName) addToIndex(exactNameIndex, fullName, player);

      const abbreviation = abbreviatedPlayerName(player);
      if (abbreviation) addToIndex(abbreviatedNameIndex, abbreviation, player);
    }

    for (const apiPlayer of apiPlayers) {
      const existing = await this.mappingRepo.findOneBy({
        provider: ExternalProvider.ApiFootball,
        entity_type: MappedEntityType.Player,
        external_id: String(apiPlayer.id),
      });
      if (existing) continue;

      const normalizedApiName = normalizeName(apiPlayer.name);
      const exactMatches = exactNameIndex.get(normalizedApiName) ?? [];
      const abbreviatedMatches =
        abbreviatedNameIndex.get(normalizedApiName) ?? [];
      const matches = exactMatches.length > 0 ? exactMatches : abbreviatedMatches;

      if (matches.length !== 1) continue;

      await this.upsertMapping(
        MappedEntityType.Player,
        apiPlayer.id,
        matches[0]!.player_id,
        {
          apiName: apiPlayer.name,
          localName: `${matches[0]!.name ?? ""} ${matches[0]!.lastname ?? ""}`.trim(),
        },
      );
    }
  }
}

export function buildInternalMatchId(fixture: ApiFootballFixtureDto): string {
  return `AF-${fixture.league.season}-${fixture.fixture.id}`;
}

interface ApiPlayerCandidate {
  id: number;
  name: string;
}

function extractApiPlayers(fixture: ApiFootballFixtureDto): ApiPlayerCandidate[] {
  const players = new Map<number, string>();

  for (const event of fixture.events ?? []) {
    addApiPlayer(players, event.player.id, event.player.name);
    addApiPlayer(players, event.assist.id, event.assist.name);
  }

  for (const teamPlayers of (fixture.players ?? []) as unknown[]) {
    const responsePlayers = getObjectArray(teamPlayers, "players");
    for (const item of responsePlayers) {
      const player = getObject(item, "player");
      addApiPlayer(players, getNumber(player, "id"), getString(player, "name"));
    }
  }

  for (const lineup of (fixture.lineups ?? []) as unknown[]) {
    for (const section of ["startXI", "substitutes"]) {
      const lineupPlayers = getObjectArray(lineup, section);
      for (const item of lineupPlayers) {
        const player = getObject(item, "player");
        addApiPlayer(players, getNumber(player, "id"), getString(player, "name"));
      }
    }
  }

  return [...players.entries()].map(([id, name]) => ({ id, name }));
}

function addApiPlayer(
  players: Map<number, string>,
  id: number | null,
  name: string | null,
) {
  if (id === null || !name) return;

  const existing = players.get(id);
  if (!existing || existing.length < name.length) {
    players.set(id, name);
  }
}

function addToIndex(
  index: Map<string, Player[]>,
  key: string,
  player: Player,
) {
  const players = index.get(key) ?? [];
  players.push(player);
  index.set(key, players);
}

function abbreviatedPlayerName(player: Player): string | null {
  const name = normalizeName(player.name ?? "");
  const lastname = normalizeName(player.lastname ?? "");
  if (!name || !lastname) return null;

  return `${name[0]} ${lastname}`;
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
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
