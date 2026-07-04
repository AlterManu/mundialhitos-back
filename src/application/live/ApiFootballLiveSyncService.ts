import { DataSource } from "typeorm";
import { ApiFootballClient } from "@/infrastructure/apiFootball/ApiFootballClient";
import { ApiFootballLiveEventMapper } from "@/infrastructure/apiFootball/ApiFootballLiveEventMapper";
import { ExternalIdMappingResolver } from "@/infrastructure/apiFootball/ExternalIdMappingResolver";
import { ApiFootballFixtureStore } from "./ApiFootballFixtureStore";
import { LiveEventProcessor } from "./LiveEventProcessor";

export class ApiFootballLiveSyncService {
  private readonly mapper: ApiFootballLiveEventMapper;
  private readonly processor: LiveEventProcessor;
  private readonly fixtureStore: ApiFootballFixtureStore;

  constructor(
    dataSource: DataSource,
    private readonly client: ApiFootballClient,
  ) {
    this.mapper = new ApiFootballLiveEventMapper(
      new ExternalIdMappingResolver(dataSource),
    );
    this.processor = new LiveEventProcessor(dataSource);
    this.fixtureStore = new ApiFootballFixtureStore(dataSource);
  }

  async syncFixture(fixtureId: number) {
    const fixture = await this.client.getFixture(fixtureId);
    if (!fixture) {
      return { fixtureId, events: 0, insights: 0, processed: [] };
    }

    await this.fixtureStore.upsertFixture(fixture);
    const events = await this.mapper.toLiveEvents(fixture);
    const processed = [];

    for (const event of events) {
      processed.push(await this.processor.process(event));
    }

    return {
      fixtureId,
      events: events.length,
      insights: processed.reduce((sum, item) => sum + item.insights.length, 0),
      processed,
    };
  }
}
