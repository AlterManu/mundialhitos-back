import path from "path";
import { DataSource } from "typeorm";
import { MatchInsightGenerationService } from "@/application/insights/MatchInsightGenerationService";
import { ApiFootballLiveEventMapper } from "@/infrastructure/apiFootball/ApiFootballLiveEventMapper";
import { ExternalIdMappingResolver } from "@/infrastructure/apiFootball/ExternalIdMappingResolver";
import {
  ApiFootballFixtureDto,
  ApiFootballResponse,
} from "@/infrastructure/apiFootball/ApiFootballTypes";
import { ApiFootballFixtureStore, buildInternalMatchId } from "./ApiFootballFixtureStore";
import { ApiFootballFromFileImportService } from "./ApiFootballFromFileImportService";
import { LiveEventProcessor } from "./LiveEventProcessor";
import fs from "fs";
import { RebuildStatisticsService } from "@/application/statistics/RebuildStatisticsService";
import { Insight } from "@/entities/Insight";
import { LiveEventLog } from "@/entities/LiveEventLog";

export interface ApiFootballSimulationResult {
  importedFixtures: number;
  simulatedMatchId: string;
  preInsights: number;
  processedEvents: number;
  liveInsights: number;
  postInsights: number;
}

export class ApiFootballSimulationService {
  private readonly fixtureStore: ApiFootballFixtureStore;
  private readonly fileImporter: ApiFootballFromFileImportService;
  private readonly mapper: ApiFootballLiveEventMapper;
  private readonly processor: LiveEventProcessor;
  private readonly insightGenerator: MatchInsightGenerationService;

  constructor(private readonly dataSource: DataSource) {
    this.fixtureStore = new ApiFootballFixtureStore(dataSource);
    this.fileImporter = new ApiFootballFromFileImportService(dataSource);
    this.mapper = new ApiFootballLiveEventMapper(
      new ExternalIdMappingResolver(dataSource),
    );
    this.processor = new LiveEventProcessor(dataSource);
    this.insightGenerator = new MatchInsightGenerationService(dataSource);
  }

  async simulateFromFiles(options?: {
    leagueFile?: string;
    fixtureFile?: string;
  }): Promise<ApiFootballSimulationResult> {
    const fromApiDir = path.resolve(__dirname, "../../from-api");
    const leagueFile =
      options?.leagueFile ??
      path.join(fromApiDir, "fixture-league-1-season-2022.json");
    const fixtureFile =
      options?.fixtureFile ?? path.join(fromApiDir, "fixture-id-979139.json");

    const importedFixtures = await this.fileImporter.importFixtureFile(leagueFile);
    const fixture = this.readSingleFixture(fixtureFile);
    await this.fixtureStore.upsertFixture(fixture);

    const internalMatchId = buildInternalMatchId(fixture);
    await this.resetSimulationState(internalMatchId);
    const preInsights =
      await this.insightGenerator.generatePreMatch(internalMatchId);
    const events = await this.mapper.toLiveEvents(fixture);
    const processed = [];

    for (const event of events) {
      processed.push(await this.processor.process(event));
    }

    const postInsights =
      await this.insightGenerator.generatePostMatch(internalMatchId);

    return {
      importedFixtures: importedFixtures.length,
      simulatedMatchId: internalMatchId,
      preInsights: preInsights.length,
      processedEvents: processed.length,
      liveInsights: processed.reduce((sum, item) => sum + item.insights.length, 0),
      postInsights: postInsights.length,
    };
  }

  private async resetSimulationState(internalMatchId: string) {
    await this.dataSource.getRepository(Insight).delete({
      match_id: internalMatchId,
    });
    await this.dataSource.getRepository(LiveEventLog).delete({
      match_id: internalMatchId,
    });
    await new RebuildStatisticsService(this.dataSource).rebuild();
  }

  private readSingleFixture(filePath: string): ApiFootballFixtureDto {
    const payload = JSON.parse(
      fs.readFileSync(filePath, "utf8"),
    ) as ApiFootballResponse<ApiFootballFixtureDto>;
    const fixture = payload.response[0];
    if (!fixture) {
      throw new Error(`No fixture found in ${filePath}`);
    }
    return fixture;
  }
}
