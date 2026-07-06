import { DataSource, Repository } from "typeorm";
import { ApiFootballFixture } from "@/entities/ApiFootballFixture";
import { Match } from "@/entities/Match";
import {
  ApiFootballHistoricalMaterializationResult,
  ApiFootballHistoricalMaterializer,
} from "./ApiFootballHistoricalMaterializer";
import { ApiFootballFixtureDto } from "@/infrastructure/apiFootball/ApiFootballTypes";

export interface NextSimulationFixtureResult {
  fixture: ApiFootballFixture | null;
  remaining: number;
}

export interface MaterializeNextSimulationFixtureResult {
  fixture: ApiFootballFixture | null;
  result: ApiFootballHistoricalMaterializationResult | null;
  remainingAfter: number;
}

export class ApiFootballChronologicalSimulationService {
  private readonly fixtureRepo: Repository<ApiFootballFixture>;
  private readonly matchRepo: Repository<Match>;
  private readonly materializer: ApiFootballHistoricalMaterializer;

  constructor(dataSource: DataSource) {
    this.fixtureRepo = dataSource.getRepository(ApiFootballFixture);
    this.matchRepo = dataSource.getRepository(Match);
    this.materializer = new ApiFootballHistoricalMaterializer(dataSource);
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
