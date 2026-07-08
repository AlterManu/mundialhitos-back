import "reflect-metadata";
import dotenv from "dotenv";
import { AppDataSource } from "@/config/dataSource";
import { ApiFootballChronologicalSimulationService } from "@/application/live/ApiFootballChronologicalSimulationService";

dotenv.config();

async function main() {
  const season = Number(process.argv[2] ?? 2022);
  const limitArg = process.argv[3];
  const limit = limitArg ? Number(limitArg) : undefined;

  if (!Number.isInteger(season)) {
    throw new Error("Usage: pnpm api-football:simulate-season <season> [limit]");
  }
  if (limit !== undefined && !Number.isInteger(limit)) {
    throw new Error("limit must be a number");
  }

  await AppDataSource.initialize();
  const result = await new ApiFootballChronologicalSimulationService(
    AppDataSource,
  ).simulatePendingSeason(season, limit === undefined ? undefined : { limit });
  console.log("Season simulation completed:", JSON.stringify(result, null, 2));
  await AppDataSource.destroy();
}

main().catch(async (error) => {
  console.error(error);
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(1);
});
