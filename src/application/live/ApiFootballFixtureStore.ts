import { DataSource, Repository } from "typeorm";
import {
  extractFixtureEntities,
  type ApiFootballPlayerCandidate,
} from "@/application/mapping/ApiFootballFixtureEntityExtractor";
import { ApiFootballEntityReconciler } from "@/application/mapping/ApiFootballEntityReconciler";
import { ApiFootballFixture as ApiFootballFixtureEntity } from "@/entities/ApiFootballFixture";
import {
  ExternalIdMapping,
  ExternalProvider,
  MappedEntityType,
} from "@/entities/ExternalIdMapping";
import { ApiFootballFixtureDto } from "@/infrastructure/apiFootball/ApiFootballTypes";

export class ApiFootballFixtureStore {
  private readonly fixtureRepo: Repository<ApiFootballFixtureEntity>;
  private readonly mappingRepo: Repository<ExternalIdMapping>;
  private readonly reconciler: ApiFootballEntityReconciler;

  constructor(private readonly dataSource: DataSource) {
    this.fixtureRepo = dataSource.getRepository(ApiFootballFixtureEntity);
    this.mappingRepo = dataSource.getRepository(ExternalIdMapping);
    this.reconciler = new ApiFootballEntityReconciler(dataSource);
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
    const entities = extractFixtureEntities(fixture);
    const homeTeam = await this.reconciler.reconcileTeam(entities.teams[0]!);
    const awayTeam = await this.reconciler.reconcileTeam(entities.teams[1]!);
    await this.reconciler.reconcileVenue(entities.venue);

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
      home_local_team_id: homeTeam.localId,
      away_api_team_id: String(fixture.teams.away.id),
      away_team_name: fixture.teams.away.name,
      away_local_team_id: awayTeam.localId,
      home_goals: fixture.goals.home,
      home_winner: fixture.teams.home.winner,
      away_goals: fixture.goals.away,
      away_winner: fixture.teams.away.winner,
      score: (fixture.score ?? {}) as Record<string, unknown>,
      raw_fixture: fixture as unknown as Record<string, unknown>,
    });

    const saved = await this.fixtureRepo.save(entity);
    await this.reconcilePlayerMappingsFromFixture(fixture, entities.players, {
      homeLocalTeamId: homeTeam.localId,
      awayLocalTeamId: awayTeam.localId,
    });
    return saved;
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
    mapping.metadata = {
      ...metadata,
      status: "matched",
      confidence: "exact",
      strategy: "api_fixture_id",
      reconciledAt: new Date().toISOString(),
    };
    await this.mappingRepo.save(mapping);
  }

  private async reconcilePlayerMappingsFromFixture(
    fixture: ApiFootballFixtureDto,
    apiPlayers: ApiFootballPlayerCandidate[],
    teams: { homeLocalTeamId: string; awayLocalTeamId: string },
  ) {
    for (const apiPlayer of apiPlayers) {
      const localTeamId = this.localTeamIdForApiTeam(fixture, apiPlayer.apiTeamId, teams);
      await this.reconciler.reconcilePlayer(apiPlayer, {
        localTeamId,
        season: fixture.league.season,
        sameTeamPlayers: apiPlayers.filter(
          (player) => player.apiTeamId === apiPlayer.apiTeamId,
        ),
      });
    }
  }

  private localTeamIdForApiTeam(
    fixture: ApiFootballFixtureDto,
    apiTeamId: number | null,
    teams: { homeLocalTeamId: string; awayLocalTeamId: string },
  ): string | null {
    if (apiTeamId === fixture.teams.home.id) {
      return teams.homeLocalTeamId;
    }
    if (apiTeamId === fixture.teams.away.id) {
      return teams.awayLocalTeamId;
    }

    return null;
  }
}

export function buildInternalMatchId(fixture: ApiFootballFixtureDto): string {
  return `AF-${fixture.league.season}-${fixture.fixture.id}`;
}
