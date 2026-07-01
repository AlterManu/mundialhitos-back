import { Router, type Router as ExpressRouter } from "express";
import { AppDataSource } from "@/config/dataSource";
import { ApiFootballLiveSyncService } from "@/application/live/ApiFootballLiveSyncService";
import { ApiFootballClient } from "@/infrastructure/apiFootball/ApiFootballClient";

export const liveRoutes: ExpressRouter = Router();

liveRoutes.post("/api-football/fixtures/:fixtureId/sync", async (req, res, next) => {
  try {
    const fixtureId = Number(req.params.fixtureId);
    const apiKey = process.env.API_FOOTBALL_KEY;

    if (!Number.isInteger(fixtureId)) {
      res.status(400).json({ error: "fixtureId must be a number" });
      return;
    }

    if (!apiKey) {
      res.status(500).json({ error: "API_FOOTBALL_KEY is not configured" });
      return;
    }

    const service = new ApiFootballLiveSyncService(
      AppDataSource,
      new ApiFootballClient({ apiKey }),
    );
    const result = await service.syncFixture(fixtureId);

    res.json({
      fixtureId: result.fixtureId,
      events: result.events,
      insights: result.insights,
    });
  } catch (error) {
    next(error);
  }
});
