import { Router, type Router as ExpressRouter } from "express";
import { ApiFootballMappingBootstrapJobManager } from "@/application/mapping/ApiFootballMappingBootstrapJobManager";
import {
  ApiFootballMappingBootstrapOptions,
  ApiFootballMappingBootstrapService,
} from "@/application/mapping/ApiFootballMappingBootstrapService";
import { ApiFootballMappingMaintenanceService } from "@/application/mapping/ApiFootballMappingMaintenanceService";
import { AppDataSource } from "@/config/dataSource";
import { ApiFootballClient } from "@/infrastructure/apiFootball/ApiFootballClient";

export const adminRoutes: ExpressRouter = Router();

let bootstrapJobManager: ApiFootballMappingBootstrapJobManager | null = null;

adminRoutes.post(
  "/api-football/world-cup/:season/bootstrap",
  async (req, res, next) => {
    try {
      const season = Number(req.params.season);
      if (!Number.isInteger(season)) {
        res.status(400).json({ error: "season must be a number" });
        return;
      }

      const client = createApiFootballClient(res);
      if (!client) return;

      const limit = parseOptionalInteger(req.body?.limit);
      const options: ApiFootballMappingBootstrapOptions = {
        season,
        leagueId: parseInteger(req.body?.leagueId, 1),
        hydrateFixtures: parseBoolean(req.body?.hydrateFixtures, true),
        delayMs: parseInteger(req.body?.delayMs, 250),
      };
      if (limit !== undefined) {
        options.limit = limit;
      }

      const runAsync = parseBoolean(req.body?.async, true);
      if (!runAsync) {
        const result = await new ApiFootballMappingBootstrapService(
          AppDataSource,
          client,
        ).bootstrap(options);
        res.json({ data: result });
        return;
      }

      const manager = getBootstrapJobManager(client);
      const job = manager.start(options);
      res.status(202).json({ data: job });
    } catch (error) {
      next(error);
    }
  },
);

adminRoutes.get("/api-football/bootstrap-jobs", async (_req, res, next) => {
  try {
    const client = createApiFootballClient(res);
    if (!client) return;

    res.json({ data: getBootstrapJobManager(client).list() });
  } catch (error) {
    next(error);
  }
});

adminRoutes.get("/api-football/bootstrap-jobs/:jobId", async (req, res, next) => {
  try {
    const client = createApiFootballClient(res);
    if (!client) return;

    const job = getBootstrapJobManager(client).get(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: "bootstrap job not found" });
      return;
    }

    res.json({ data: job });
  } catch (error) {
    next(error);
  }
});

adminRoutes.post(
  "/api-football/mappings/players/reclassify-created",
  async (_req, res, next) => {
    try {
      const result = await new ApiFootballMappingMaintenanceService(
        AppDataSource,
      ).reclassifyCreatedPlayerMappings();
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

function getBootstrapJobManager(client: ApiFootballClient) {
  bootstrapJobManager ??= new ApiFootballMappingBootstrapJobManager(
    AppDataSource,
    client,
  );
  return bootstrapJobManager;
}

function createApiFootballClient(res: {
  status: (code: number) => { json: (body: unknown) => void };
}): ApiFootballClient | null {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "API_FOOTBALL_KEY is not configured" });
    return null;
  }

  return new ApiFootballClient({ apiKey });
}

function parseInteger(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function parseOptionalInteger(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}
