import { DataSource } from "typeorm";
import { ApiFootballFixtureStore } from "@/application/live/ApiFootballFixtureStore";
import { ExternalIdMapping, MappedEntityType } from "@/entities/ExternalIdMapping";
import { Player } from "@/entities/Player";
import { Team } from "@/entities/Team";
import { Venue } from "@/entities/Venue";
import { ApiFootballClient } from "@/infrastructure/apiFootball/ApiFootballClient";

export interface ApiFootballMappingBootstrapOptions {
  leagueId: number;
  season: number;
  hydrateFixtures: boolean;
  limit?: number;
  delayMs?: number;
}

export interface ApiFootballMappingBootstrapFailure {
  fixtureId: number;
  message: string;
}

export interface ApiFootballMappingBootstrapResult {
  leagueId: number;
  season: number;
  fixtureSummaries: number;
  upsertedFixtures: number;
  hydratedFixtures: number;
  failures: ApiFootballMappingBootstrapFailure[];
  mappingsBefore: Record<string, number>;
  mappingsAfter: Record<string, number>;
  entitiesBefore: Record<string, number>;
  entitiesAfter: Record<string, number>;
  durationMs: number;
}

export class ApiFootballMappingBootstrapService {
  private readonly fixtureStore: ApiFootballFixtureStore;

  constructor(
    private readonly dataSource: DataSource,
    private readonly client: ApiFootballClient,
  ) {
    this.fixtureStore = new ApiFootballFixtureStore(dataSource);
  }

  async bootstrap(
    options: ApiFootballMappingBootstrapOptions,
  ): Promise<ApiFootballMappingBootstrapResult> {
    const startedAt = Date.now();
    const mappingsBefore = await this.countMappings();
    const entitiesBefore = await this.countEntities();
    const fixtureResponse = await this.client.getFixtures(
      options.leagueId,
      options.season,
    );
    const fixtureSummaries = fixtureResponse.response.slice(
      0,
      options.limit ?? fixtureResponse.response.length,
    );

    const failures: ApiFootballMappingBootstrapFailure[] = [];
    let upsertedFixtures = 0;
    let hydratedFixtures = 0;

    for (const fixtureSummary of fixtureSummaries) {
      try {
        await this.fixtureStore.upsertFixture(fixtureSummary);
        upsertedFixtures += 1;

        if (options.hydrateFixtures) {
          const detailedFixture = await this.client.getFixture(fixtureSummary.fixture.id);
          if (detailedFixture) {
            await this.fixtureStore.upsertFixture(detailedFixture);
            hydratedFixtures += 1;
          }
        }

        if (options.delayMs && options.delayMs > 0) {
          await sleep(options.delayMs);
        }
      } catch (error) {
        failures.push({
          fixtureId: fixtureSummary.fixture.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      leagueId: options.leagueId,
      season: options.season,
      fixtureSummaries: fixtureSummaries.length,
      upsertedFixtures,
      hydratedFixtures,
      failures,
      mappingsBefore,
      mappingsAfter: await this.countMappings(),
      entitiesBefore,
      entitiesAfter: await this.countEntities(),
      durationMs: Date.now() - startedAt,
    };
  }

  private async countMappings() {
    const mappingRepo = this.dataSource.getRepository(ExternalIdMapping);
    const entries = await Promise.all(
      Object.values(MappedEntityType).map(async (entityType) => [
        entityType,
        await mappingRepo.countBy({ entity_type: entityType }),
      ]),
    );

    return Object.fromEntries(entries) as Record<string, number>;
  }

  private async countEntities() {
    return {
      teams: await this.dataSource.getRepository(Team).count(),
      players: await this.dataSource.getRepository(Player).count(),
      venues: await this.dataSource.getRepository(Venue).count(),
    };
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
