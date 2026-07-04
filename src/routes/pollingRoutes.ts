import { Router, type Router as ExpressRouter } from "express";
import { FixturePollingManager } from "@/application/live/FixturePollingManager";
import { ApiFootballClient } from "@/infrastructure/apiFootball/ApiFootballClient";
import { AppDataSource } from "@/config/dataSource";

export const pollingRoutes: ExpressRouter = Router();

let pollingManager: FixturePollingManager | null = null;

pollingRoutes.get("/status", async (req, res, next) => {
  try {
    const manager = getPollingManager();
    const matchId =
      typeof req.query.matchId === "string" ? req.query.matchId : undefined;
    res.json({ data: await manager.status(matchId) });
  } catch (error) {
    next(error);
  }
});

pollingRoutes.post("/fixtures/:matchId/start", async (req, res, next) => {
  try {
    const manager = getPollingManager();
    const intervalSeconds = parseInterval(req.body?.intervalSeconds);
    const state =
      intervalSeconds === undefined
        ? await manager.start(req.params.matchId)
        : await manager.start(req.params.matchId, { intervalSeconds });
    res.json({ data: state });
  } catch (error) {
    next(error);
  }
});

pollingRoutes.post("/fixtures/:matchId/stop", async (req, res, next) => {
  try {
    const manager = getPollingManager();
    const state = await manager.stop(req.params.matchId);
    res.json({ data: state });
  } catch (error) {
    next(error);
  }
});

function getPollingManager() {
  if (pollingManager) return pollingManager;

  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    throw new Error("API_FOOTBALL_KEY is not configured");
  }

  pollingManager = new FixturePollingManager(
    AppDataSource,
    new ApiFootballClient({ apiKey }),
  );
  return pollingManager;
}

function parseInterval(value: unknown): number | undefined {
  if (typeof value !== "number") return undefined;
  return value;
}
