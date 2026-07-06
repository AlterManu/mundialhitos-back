import { DataSource } from "typeorm";
import { ApiFootballFixtureStore } from "@/application/live/ApiFootballFixtureStore";
import {
  ApiFootballHistoricalMaterializationResult,
  ApiFootballHistoricalMaterializer,
} from "@/application/live/ApiFootballHistoricalMaterializer";
import {
  ExternalIdMapping,
  ExternalProvider,
  MappedEntityType,
} from "@/entities/ExternalIdMapping";
import { ApiFootballClient } from "@/infrastructure/apiFootball/ApiFootballClient";

export interface ApiFootballFixturePreloadOptions {
  leagueId: number;
  season: number;
  hydrateFixtures: boolean;
  materializeFinishedFixtures: boolean;
  limit?: number;
  delayMs?: number;
}

export interface ApiFootballFixturePreloadFailure {
  fixtureId: number;
  message: string;
}

export interface ApiFootballFixturePreloadResult {
  leagueId: number;
  season: number;
  fetchedFixtures: number;
  upsertedFixtures: number;
  hydratedFixtures: number;
  failures: ApiFootballFixturePreloadFailure[];
  statusBreakdown: Record<string, number>;
  rawPayloadBreakdown: {
    fixturesWithEvents: number;
    fixturesWithLineups: number;
    fixturesWithPlayerStats: number;
  };
  materialized: ApiFootballHistoricalMaterializationResult;
  mappings: {
    total: Record<string, number>;
    lowConfidence: Record<string, number>;
    createdFromApi: Record<string, number>;
    needsReview: ExternalIdMapping[];
  };
  durationMs: number;
}

export class ApiFootballFixturePreloadService {
  private readonly fixtureStore: ApiFootballFixtureStore;
  private readonly materializer: ApiFootballHistoricalMaterializer;

  constructor(
    private readonly dataSource: DataSource,
    private readonly client: ApiFootballClient,
  ) {
    this.fixtureStore = new ApiFootballFixtureStore(dataSource);
    this.materializer = new ApiFootballHistoricalMaterializer(dataSource);
  }

  async preload(
    options: ApiFootballFixturePreloadOptions,
  ): Promise<ApiFootballFixturePreloadResult> {
    const startedAt = Date.now();
    const response = await this.client.getFixtures(options.leagueId, options.season);
    const fixtures = response.response.slice(
      0,
      options.limit ?? response.response.length,
    );
    const failures: ApiFootballFixturePreloadFailure[] = [];
    const statusBreakdown: Record<string, number> = {};
    const rawPayloadBreakdown = {
      fixturesWithEvents: 0,
      fixturesWithLineups: 0,
      fixturesWithPlayerStats: 0,
    };
    const materialized = emptyMaterializationResult();
    let upsertedFixtures = 0;
    let hydratedFixtures = 0;

    for (const fixtureSummary of fixtures) {
      try {
        await this.fixtureStore.upsertFixture(fixtureSummary);
        upsertedFixtures += 1;

        const fixture =
          options.hydrateFixtures
            ? await this.client.getFixture(fixtureSummary.fixture.id)
            : fixtureSummary;
        if (fixture && fixture !== fixtureSummary) {
          await this.fixtureStore.upsertFixture(fixture);
          hydratedFixtures += 1;
        }

        const storedFixture = fixture ?? fixtureSummary;
        const status = storedFixture.fixture.status.short || "unknown";
        statusBreakdown[status] = (statusBreakdown[status] ?? 0) + 1;
        if ((storedFixture.events ?? []).length > 0) {
          rawPayloadBreakdown.fixturesWithEvents += 1;
        }
        if ((storedFixture.lineups ?? []).length > 0) {
          rawPayloadBreakdown.fixturesWithLineups += 1;
        }
        if ((storedFixture.players ?? []).length > 0) {
          rawPayloadBreakdown.fixturesWithPlayerStats += 1;
        }
        if (options.materializeFinishedFixtures) {
          addMaterializationResult(
            materialized,
            await this.materializer.materialize(storedFixture),
          );
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
      fetchedFixtures: fixtures.length,
      upsertedFixtures,
      hydratedFixtures,
      failures,
      statusBreakdown,
      rawPayloadBreakdown,
      materialized,
      mappings: await this.mappingReview(options.season),
      durationMs: Date.now() - startedAt,
    };
  }

  private async mappingReview(season: number) {
    const repo = this.dataSource.getRepository(ExternalIdMapping);
    const [total, lowConfidence, createdFromApi, needsReview] = await Promise.all([
      this.countMappings(repo, season),
      this.countMappings(repo, season, "confidence", "low"),
      this.countMappings(repo, season, "status", "created"),
      this.needsReview(repo, season),
    ]);

    return { total, lowConfidence, createdFromApi, needsReview };
  }

  private async countMappings(
    repo: import("typeorm").Repository<ExternalIdMapping>,
    season: number,
    metadataKey?: "confidence" | "status",
    metadataValue?: string,
  ) {
    const entries = await Promise.all(
      Object.values(MappedEntityType).map(async (entityType) => {
        const query = repo
          .createQueryBuilder("mapping")
          .where("mapping.provider = :provider", {
            provider: ExternalProvider.ApiFootball,
          })
          .andWhere("mapping.entity_type = :entityType", { entityType });

        if (metadataKey && metadataValue) {
          query.andWhere(`mapping.metadata->>'${metadataKey}' = :metadataValue`, {
            metadataValue,
          });
        }

        query.andWhere(
          "(mapping.metadata->>'season' = :season OR mapping.metadata->>'season' IS NULL)",
          { season: String(season) },
        );

        return [entityType, await query.getCount()];
      }),
    );

    return Object.fromEntries(entries) as Record<string, number>;
  }

  private async needsReview(
    repo: import("typeorm").Repository<ExternalIdMapping>,
    season: number,
  ) {
    return repo
      .createQueryBuilder("mapping")
      .where("mapping.provider = :provider", {
        provider: ExternalProvider.ApiFootball,
      })
      .andWhere(
        "(mapping.metadata->>'confidence' = :low OR mapping.metadata->>'status' = :created)",
        { low: "low", created: "created" },
      )
      .andWhere(
        "(mapping.metadata->>'season' = :season OR mapping.metadata->>'season' IS NULL)",
        { season: String(season) },
      )
      .orderBy("mapping.entity_type", "ASC")
      .addOrderBy("mapping.external_id", "ASC")
      .take(100)
      .getMany();
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function emptyMaterializationResult(): ApiFootballHistoricalMaterializationResult {
  return {
    materializedMatches: 0,
    goals: 0,
    cards: 0,
    substitutions: 0,
    penaltyKicks: 0,
    playerAppearances: 0,
    skippedUnresolvedEvents: 0,
  };
}

function addMaterializationResult(
  target: ApiFootballHistoricalMaterializationResult,
  incoming: ApiFootballHistoricalMaterializationResult,
) {
  target.materializedMatches += incoming.materializedMatches;
  target.goals += incoming.goals;
  target.cards += incoming.cards;
  target.substitutions += incoming.substitutions;
  target.penaltyKicks += incoming.penaltyKicks;
  target.playerAppearances += incoming.playerAppearances;
  target.skippedUnresolvedEvents += incoming.skippedUnresolvedEvents;
}
