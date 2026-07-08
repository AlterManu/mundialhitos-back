import { DataSource, Repository } from "typeorm";
import { MatchInsightGenerationService } from "@/application/insights/MatchInsightGenerationService";
import { RebuildStatisticsService } from "@/application/statistics/RebuildStatisticsService";
import { ApiFootballFixture } from "@/entities/ApiFootballFixture";
import { Match } from "@/entities/Match";
import {
  ApiFootballHistoricalMaterializationResult,
  ApiFootballHistoricalMaterializer,
} from "./ApiFootballHistoricalMaterializer";
import { ApiFootballFixtureDto } from "@/infrastructure/apiFootball/ApiFootballTypes";
import {
  StoredApiFootballFixtureEventProcessingResult,
  StoredApiFootballFixtureEventProcessor,
} from "./StoredApiFootballFixtureEventProcessor";

export interface NextSimulationFixtureResult {
  fixture: ApiFootballFixture | null;
  remaining: number;
}

export interface MaterializeNextSimulationFixtureResult {
  fixture: ApiFootballFixture | null;
  result: ApiFootballHistoricalMaterializationResult | null;
  remainingAfter: number;
}

export interface CompleteMatchSimulationResult {
  matchId: string;
  apiFixtureId: string;
  season: number;
  preInsights: number;
  events: StoredApiFootballFixtureEventProcessingResult;
  postInsights: number;
  materialized: ApiFootballHistoricalMaterializationResult;
  remainingAfter: number;
}

export interface CompleteSeasonSimulationResult {
  season: number;
  processedMatches: number;
  remaining: number;
  totals: {
    preInsights: number;
    processedEvents: number;
    liveInsights: number;
    postInsights: number;
  };
  matches: CompleteMatchSimulationResult[];
}

export class ApiFootballChronologicalSimulationService {
  private readonly fixtureRepo: Repository<ApiFootballFixture>;
  private readonly matchRepo: Repository<Match>;
  private readonly materializer: ApiFootballHistoricalMaterializer;
  private readonly insightGenerator: MatchInsightGenerationService;
  private readonly eventProcessor: StoredApiFootballFixtureEventProcessor;
  private readonly statisticsRebuilder: RebuildStatisticsService;

  constructor(private readonly dataSource: DataSource) {
    this.fixtureRepo = dataSource.getRepository(ApiFootballFixture);
    this.matchRepo = dataSource.getRepository(Match);
    this.materializer = new ApiFootballHistoricalMaterializer(dataSource);
    this.insightGenerator = new MatchInsightGenerationService(dataSource);
    this.eventProcessor = new StoredApiFootballFixtureEventProcessor(dataSource);
    this.statisticsRebuilder = new RebuildStatisticsService(dataSource);
  }

  async nextFixture(season: number): Promise<NextSimulationFixtureResult> {
    const pending = await this.pendingFixtures(season);
    return {
      fixture: pending[0] ?? null,
      remaining: pending.length,
    };
  }

  async materializeNext(
    season: number,
  ): Promise<MaterializeNextSimulationFixtureResult> {
    const pendingBefore = await this.pendingFixtures(season);
    const fixture = pendingBefore[0] ?? null;
    if (!fixture) {
      return { fixture: null, result: null, remainingAfter: 0 };
    }

    const result = await this.materializer.materialize(
      fixture.raw_fixture as unknown as ApiFootballFixtureDto,
    );
    const pendingAfter = await this.pendingFixtures(season);

    return {
      fixture,
      result,
      remainingAfter: pendingAfter.length,
    };
  }

  async simulateNextComplete(
    season: number,
  ): Promise<CompleteMatchSimulationResult | null> {
    const pendingBefore = await this.pendingFixtures(season);
    const fixture = pendingBefore[0] ?? null;
    if (!fixture) return null;

    const matchId = fixture.internal_match_id;
    const preInsights = await this.insightGenerator.generatePreMatch(matchId);
    const events = await this.eventProcessor.processMatch(matchId);
    const postInsights = await this.insightGenerator.generatePostMatch(matchId);
    const materialized = await this.materializer.materialize(
      fixture.raw_fixture as unknown as ApiFootballFixtureDto,
    );

    await this.statisticsRebuilder.rebuild();

    return {
      matchId,
      apiFixtureId: fixture.api_fixture_id,
      season: fixture.season,
      preInsights: preInsights.length,
      events,
      postInsights: postInsights.length,
      materialized,
      remainingAfter: (await this.pendingFixtures(season)).length,
    };
  }

  async simulatePendingSeason(
    season: number,
    options?: { limit?: number },
  ): Promise<CompleteSeasonSimulationResult> {
    const matches: CompleteMatchSimulationResult[] = [];
    const limit = options?.limit ?? Number.MAX_SAFE_INTEGER;

    while (matches.length < limit) {
      const result = await this.simulateNextComplete(season);
      if (!result) break;
      matches.push(result);
    }

    return {
      season,
      processedMatches: matches.length,
      remaining: (await this.pendingFixtures(season)).length,
      totals: {
        preInsights: matches.reduce((sum, item) => sum + item.preInsights, 0),
        processedEvents: matches.reduce(
          (sum, item) => sum + item.events.processedEvents,
          0,
        ),
        liveInsights: matches.reduce(
          (sum, item) => sum + item.events.liveInsights,
          0,
        ),
        postInsights: matches.reduce((sum, item) => sum + item.postInsights, 0),
      },
      matches,
    };
  }

  private async pendingFixtures(season: number) {
    const fixtures = await this.fixtureRepo.find({
      where: { season },
      order: { kickoff_at: "ASC", api_fixture_id: "ASC" },
    });
    const materializedMatchIds = new Set(
      (
        await this.matchRepo.find({
          where: { world_cup_year: season },
          select: { match_id: true },
        })
      ).map((match) => match.match_id),
    );

    return fixtures.filter(
      (fixture) => !materializedMatchIds.has(fixture.internal_match_id),
    );
  }
}
