import "reflect-metadata";
import dotenv from "dotenv";
import { AppDataSource } from "@/config/dataSource";
import { RebuildStatisticsService } from "@/application/statistics/RebuildStatisticsService";

dotenv.config();

async function main() {
  await AppDataSource.initialize();
  const result = await new RebuildStatisticsService(AppDataSource).rebuild();
  console.log("Statistics rebuilt:", result);
  await AppDataSource.destroy();
}

main().catch(async (error) => {
  console.error(error);
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(1);
});
