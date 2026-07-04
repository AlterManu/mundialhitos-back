import "reflect-metadata";
import dotenv from "dotenv";
import { AppDataSource } from "@/config/dataSource";
import { ApiFootballSimulationService } from "@/application/live/ApiFootballSimulationService";

dotenv.config();

async function main() {
  await AppDataSource.initialize();
  const result = await new ApiFootballSimulationService(
    AppDataSource,
  ).simulateFromFiles();
  console.log("API-Football simulation completed:", result);
  await AppDataSource.destroy();
}

main().catch(async (error) => {
  console.error(error);
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(1);
});
