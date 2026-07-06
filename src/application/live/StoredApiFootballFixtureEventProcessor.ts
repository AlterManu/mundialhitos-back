import { DataSource, Repository } from "typeorm";
import { ApiFootballLiveEventMapper } from "@/infrastructure/apiFootball/ApiFootballLiveEventMapper";
import { ExternalIdMappingResolver } from "@/infrastructure/apiFootball/ExternalIdMappingResolver";
import { ApiFootballFixtureDto } from "@/infrastructure/apiFootball/ApiFootballTypes";
import { ApiFootballFixture } from "@/entities/ApiFootballFixture";
import { LiveEventProcessor } from "./LiveEventProcessor";

export interface StoredApiFootballFixtureEventProcessingResult {
  matchId: string;
  apiFixtureId: string;
  mappedEvents: number;
  processedEvents: number;
  alreadyProcessedEvents: number;
  liveInsights: number;
}

export class StoredApiFootballFixtureEventProcessor {
  private readonly fixtureRepo: Repository<ApiFootballFixture>;
  private readonly mapper: ApiFootballLiveEventMapper;
  private readonly processor: LiveEventProcessor;

  constructor(dataSource: DataSource) {
    this.fixtureRepo = dataSource.getRepository(ApiFootballFixture);
    this.mapper = new ApiFootballLiveEventMapper(
      new ExternalIdMappingResolver(dataSource),
    );
    this.processor = new LiveEventProcessor(dataSource);
  }

  async processMatch(
    matchId: string,
  ): Promise<StoredApiFootballFixtureEventProcessingResult> {
    const fixture = await this.fixtureRepo.findOneBy({ internal_match_id: matchId });
    if (!fixture) {
      throw Object.assign(new Error(`Fixture ${matchId} not found`), {
        status: 404,
      });
    }

    const rawFixture = fixture.raw_fixture as unknown as ApiFootballFixtureDto;
    const events = await this.mapper.toLiveEvents(rawFixture);
    const processed = [];

    for (const event of events) {
      processed.push(await this.processor.process(event));
    }

    return {
      matchId,
      apiFixtureId: fixture.api_fixture_id,
      mappedEvents: events.length,
      processedEvents: processed.filter((item) => !item.alreadyProcessed).length,
      alreadyProcessedEvents: processed.filter((item) => item.alreadyProcessed).length,
      liveInsights: processed.reduce((sum, item) => sum + item.insights.length, 0),
    };
  }
}
