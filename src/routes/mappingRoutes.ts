import { Router, type Router as ExpressRouter } from "express";
import { FindManyOptions, FindOptionsWhere, IsNull } from "typeorm";
import { AppDataSource } from "@/config/dataSource";
import {
  ExternalIdMapping,
  ExternalProvider,
  MappedEntityType,
} from "@/entities/ExternalIdMapping";
import { ApiFootballFixture } from "@/entities/ApiFootballFixture";
import { LiveEventLog } from "@/entities/LiveEventLog";

export const mappingRoutes: ExpressRouter = Router();

mappingRoutes.get("/", async (req, res, next) => {
  try {
    const repo = AppDataSource.getRepository(ExternalIdMapping);
    const where: FindOptionsWhere<ExternalIdMapping> = {};
    const provider = parseProvider(req.query.provider) ?? ExternalProvider.ApiFootball;
    const entityType = parseEntityType(req.query.entityType);

    where.provider = provider;
    if (entityType) where.entity_type = entityType;

    const options: FindManyOptions<ExternalIdMapping> = {
      where,
      order: { entity_type: "ASC", external_id: "ASC" },
      take: parseLimit(req.query.limit, 500),
    };

    res.json({ data: await repo.find(options) });
  } catch (error) {
    next(error);
  }
});

mappingRoutes.post("/", async (req, res, next) => {
  try {
    const provider = parseProvider(req.body?.provider) ?? ExternalProvider.ApiFootball;
    const entityType = parseEntityType(req.body?.entityType);
    const externalId = parseRequiredString(req.body?.externalId, "externalId");
    const localId = parseRequiredString(req.body?.localId, "localId");

    if (!entityType) {
      res.status(400).json({ error: "entityType is invalid" });
      return;
    }

    const repo = AppDataSource.getRepository(ExternalIdMapping);
    const existing = await repo.findOneBy({
      provider,
      entity_type: entityType,
      external_id: externalId,
    });

    const mapping =
      existing ??
      repo.create({
        provider,
        entity_type: entityType,
        external_id: externalId,
      });

    mapping.local_id = localId;
    mapping.metadata = isRecord(req.body?.metadata) ? req.body.metadata : null;

    res.json({ data: await repo.save(mapping) });
  } catch (error) {
    next(error);
  }
});

mappingRoutes.get("/coverage", async (req, res, next) => {
  try {
    const season =
      typeof req.query.season === "string" ? Number(req.query.season) : undefined;
    const fixtureRepo = AppDataSource.getRepository(ApiFootballFixture);
    const mappingRepo = AppDataSource.getRepository(ExternalIdMapping);
    const eventRepo = AppDataSource.getRepository(LiveEventLog);

    const fixtureQuery = fixtureRepo.createQueryBuilder("fixture");
    if (season) {
      fixtureQuery.where("fixture.season = :season", { season });
    }

    const fixtures = await fixtureQuery.getMany();
    const teamMappings = await mappingRepo.countBy({
      provider: ExternalProvider.ApiFootball,
      entity_type: MappedEntityType.Team,
    });
    const playerMappings = await mappingRepo.countBy({
      provider: ExternalProvider.ApiFootball,
      entity_type: MappedEntityType.Player,
    });
    const matchMappings = await mappingRepo.countBy({
      provider: ExternalProvider.ApiFootball,
      entity_type: MappedEntityType.Match,
    });
    const eventsWithUnresolvedPlayers = await eventRepo.countBy({
      player_id: IsNull(),
    });

    res.json({
      data: {
        fixtures: fixtures.length,
        fixturesWithBothTeamsMapped: fixtures.filter(
          (fixture) => fixture.home_local_team_id && fixture.away_local_team_id,
        ).length,
        fixturesMissingHomeTeam: fixtures.filter(
          (fixture) => !fixture.home_local_team_id,
        ).length,
        fixturesMissingAwayTeam: fixtures.filter(
          (fixture) => !fixture.away_local_team_id,
        ).length,
        mappings: {
          teams: teamMappings,
          players: playerMappings,
          matches: matchMappings,
        },
        eventsWithUnresolvedPlayers,
      },
    });
  } catch (error) {
    next(error);
  }
});

function parseProvider(value: unknown): ExternalProvider | undefined {
  if (typeof value !== "string") return undefined;
  if (Object.values(ExternalProvider).includes(value as ExternalProvider)) {
    return value as ExternalProvider;
  }
  return undefined;
}

function parseEntityType(value: unknown): MappedEntityType | undefined {
  if (typeof value !== "string") return undefined;
  if (Object.values(MappedEntityType).includes(value as MappedEntityType)) {
    return value as MappedEntityType;
  }
  return undefined;
}

function parseRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }
  return value.trim();
}

function parseLimit(value: unknown, fallback: number): number {
  if (typeof value !== "string") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), 1000);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
