import "reflect-metadata";
import dotenv from "dotenv";
import { AppDataSource } from "@/config/dataSource";
import { HistoricalDatasetsImportService } from "@/application/historical/HistoricalDatasetsImportService";

dotenv.config();

async function main() {
  await AppDataSource.initialize();
  const result = await new HistoricalDatasetsImportService(AppDataSource).importAll();
  console.log("Historical datasets imported:", result);
  await AppDataSource.destroy();
}

main().catch(async (error) => {
  console.error(error);
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(1);
});
