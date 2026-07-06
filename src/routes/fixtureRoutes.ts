import { Router, type Router as ExpressRouter } from "express";
import { FindManyOptions, FindOptionsWhere } from "typeorm";
import { MatchInsightGenerationService } from "@/application/insights/MatchInsightGenerationService";
import { ApiFootballChronologicalSimulationService } from "@/application/live/ApiFootballChronologicalSimulationService";
import { ApiFootballHistoricalMaterializer } from "@/application/live/ApiFootballHistoricalMaterializer";
import { StoredApiFootballFixtureEventProcessor } from "@/application/live/StoredApiFootballFixtureEventProcessor";
import { AppDataSource } from "@/config/dataSource";
import { ApiFootballFixture } from "@/entities/ApiFootballFixture";
import { Insight, InsightPhase } from "@/entities/Insight";
import { LiveEventLog } from "@/entities/LiveEventLog";
import { ApiFootballFixtureDto } from "@/infrastructure/apiFootball/ApiFootballTypes";

export const fixtureRoutes: ExpressRouter = Router();

fixtureRoutes.get("/", async (req, res, next) => {
  try {
    const repo = AppDataSource.getRepository(ApiFootballFixture);
    const options: FindManyOptions<ApiFootballFixture> = {
      order: { kickoff_at: "ASC" },
      take: parseLimit(req.query.limit, 200),
    };

    const where: FindOptionsWhere<ApiFootballFixture> = {};
    if (typeof req.query.season === "string") {
      where.season = Number(req.query.season);
    }
    if (typeof req.query.status === "string") {
      where.status_short = req.query.status;
    }
    if (Object.keys(where).length > 0) {
      options.where = where;
    }

    const fixtures = await repo.find(options);
    res.json({ data: fixtures.map(toFixtureResponse) });
  } catch (error) {
    next(error);
  }
});

fixtureRoutes.get("/live", async (req, res, next) => {
  try {
    const repo = AppDataSource.getRepository(ApiFootballFixture);
    const season =
      typeof req.query.season === "string" ? Number(req.query.season) : undefined;
    const query = repo
      .createQueryBuilder("fixture")
      .where("fixture.status_short IN (:...statuses)", {
        statuses: ["1H", "HT", "2H", "ET", "BT", "P", "LIVE"],
      })
      .orderBy("fixture.kickoff_at", "ASC");

    if (season) {
      query.andWhere("fixture.season = :season", { season });
    }

    const fixtures = await query.getMany();
    res.json({ data: fixtures.map(toFixtureResponse) });
  } catch (error) {
    next(error);
  }
});

fixtureRoutes.get("/simulation/next", async (req, res, next) => {
  try {
    const season = parseRequiredSeason(req.query.season);
    const service = new ApiFootballChronologicalSimulationService(AppDataSource);
    const result = await service.nextFixture(season);

    res.json({
      data: {
        remaining: result.remaining,
        fixture: result.fixture ? toFixtureResponse(result.fixture) : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

fixtureRoutes.post("/simulation/next/materialize", async (req, res, next) => {
  try {
    const season = parseRequiredSeason(req.body?.season ?? req.query.season);
    const service = new ApiFootballChronologicalSimulationService(AppDataSource);
    const result = await service.materializeNext(season);

    res.json({
      data: {
        remainingAfter: result.remainingAfter,
        fixture: result.fixture ? toFixtureResponse(result.fixture) : null,
        materialized: result.result,
      },
    });
  } catch (error) {
    next(error);
  }
});

fixtureRoutes.get("/:matchId", async (req, res, next) => {
  try {
    const fixture = await getFixture(req.params.matchId);
    res.json({ data: toFixtureResponse(fixture) });
  } catch (error) {
    next(error);
  }
});

fixtureRoutes.get("/:matchId/events", async (req, res, next) => {
  try {
    const repo = AppDataSource.getRepository(LiveEventLog);
    const events = await repo.find({
      where: { match_id: req.params.matchId },
      order: { sequence_number: "ASC", created_at: "ASC" },
    });
    res.json({ data: events });
  } catch (error) {
    next(error);
  }
});

fixtureRoutes.post("/:matchId/events/process", async (req, res, next) => {
  try {
    const service = new StoredApiFootballFixtureEventProcessor(AppDataSource);
    const result = await service.processMatch(req.params.matchId);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

fixtureRoutes.post("/:matchId/materialize", async (req, res, next) => {
  try {
    const fixture = await getFixture(req.params.matchId);
    const service = new ApiFootballHistoricalMaterializer(AppDataSource);
    const result = await service.materialize(
      fixture.raw_fixture as unknown as ApiFootballFixtureDto,
    );
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

fixtureRoutes.get("/:matchId/insights", async (req, res, next) => {
  try {
    const repo = AppDataSource.getRepository(Insight);
    const phase = parsePhase(req.query.phase);
    const where: FindOptionsWhere<Insight> = { match_id: req.params.matchId };
    if (phase) where.phase = phase;

    const insights = await repo.find({
      where,
      order: { importance_score: "DESC", created_at: "DESC" },
      take: parseLimit(req.query.limit, 100),
    });

    res.json({ data: insights });
  } catch (error) {
    next(error);
  }
});

fixtureRoutes.post("/:matchId/insights/pre/generate", async (req, res, next) => {
  try {
    const service = new MatchInsightGenerationService(AppDataSource);
    const insights = await service.generatePreMatch(req.params.matchId);
    res.json({ data: insights });
  } catch (error) {
    next(error);
  }
});

fixtureRoutes.post("/:matchId/insights/post/generate", async (req, res, next) => {
  try {
    const service = new MatchInsightGenerationService(AppDataSource);
    const insights = await service.generatePostMatch(req.params.matchId);
    res.json({ data: insights });
  } catch (error) {
    next(error);
  }
});

async function getFixture(matchId: string) {
  const fixture = await AppDataSource.getRepository(ApiFootballFixture).findOneBy({
    internal_match_id: matchId,
  });
  if (!fixture) {
    const error = new Error(`Fixture ${matchId} not found`);
    Object.assign(error, { status: 404 });
    throw error;
  }
  return fixture;
}

function toFixtureResponse(fixture: ApiFootballFixture) {
  return {
    id: fixture.internal_match_id,
    apiFixtureId: fixture.api_fixture_id,
    season: fixture.season,
    round: fixture.round,
    kickoffAt: fixture.kickoff_at,
    status: {
      long: fixture.status_long,
      short: fixture.status_short,
      elapsed: fixture.elapsed,
    },
    venue: {
      name: fixture.venue_name,
      city: fixture.venue_city,
    },
    teams: {
      home: {
        apiId: fixture.home_api_team_id,
        localId: fixture.home_local_team_id,
        name: fixture.home_team_name,
        goals: fixture.home_goals,
        winner: fixture.home_winner,
      },
      away: {
        apiId: fixture.away_api_team_id,
        localId: fixture.away_local_team_id,
        name: fixture.away_team_name,
        goals: fixture.away_goals,
        winner: fixture.away_winner,
      },
    },
    score: fixture.score,
  };
}

function parsePhase(value: unknown): InsightPhase | undefined {
  if (typeof value !== "string") return undefined;
  if (Object.values(InsightPhase).includes(value as InsightPhase)) {
    return value as InsightPhase;
  }
  return undefined;
}

function parseLimit(value: unknown, fallback: number): number {
  if (typeof value !== "string") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), 500);
}

function parseRequiredSeason(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed)) {
    const error = new Error("season must be a number");
    Object.assign(error, { status: 400 });
    throw error;
  }
  return parsed;
}
