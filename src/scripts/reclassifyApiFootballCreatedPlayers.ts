import { AppDataSource } from "@/config/dataSource";
import { ApiFootballMappingMaintenanceService } from "@/application/mapping/ApiFootballMappingMaintenanceService";

async function main() {
  await AppDataSource.initialize();
  const result = await new ApiFootballMappingMaintenanceService(
    AppDataSource,
  ).reclassifyCreatedPlayerMappings();

  console.log(JSON.stringify(result, null, 2));
  await AppDataSource.destroy();
}

main().catch(async (error) => {
  console.error(error);
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(1);
});
