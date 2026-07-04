import { Router, type Router as ExpressRouter } from "express";
import { ApiFootballSimulationService } from "@/application/live/ApiFootballSimulationService";
import { AppDataSource } from "@/config/dataSource";

export const devRoutes: ExpressRouter = Router();

devRoutes.post("/api-football/simulate-2022", async (_req, res, next) => {
  try {
    const result = await new ApiFootballSimulationService(
      AppDataSource,
    ).simulateFromFiles();
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});
