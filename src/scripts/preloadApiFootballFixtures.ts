import "reflect-metadata";
import dotenv from "dotenv";
import { ApiFootballFixturePreloadService } from "@/application/live/ApiFootballFixturePreloadService";
import { AppDataSource } from "@/config/dataSource";
import { ApiFootballClient } from "@/infrastructure/apiFootball/ApiFootballClient";

dotenv.config();

async function main() {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    throw new Error("API_FOOTBALL_KEY is not configured");
  }

  const season = Number(process.argv[2] ?? process.env.API_FOOTBALL_SEASON);
  if (!Number.isInteger(season)) {
    throw new Error("Usage: pnpm api-football:preload-fixtures <season>");
  }

  const leagueId = Number(process.argv[3] ?? process.env.API_FOOTBALL_LEAGUE_ID ?? 1);
  if (!Number.isInteger(leagueId)) {
    throw new Error("leagueId must be a number");
  }
  const hydrateFixtures = process.argv[4] !== "summary-only";
  const materializeFinishedFixtures = process.argv.includes("--materialize");

  await AppDataSource.initialize();
  const result = await new ApiFootballFixturePreloadService(
    AppDataSource,
    new ApiFootballClient({ apiKey }),
  ).preload({
    leagueId,
    season,
    hydrateFixtures,
    materializeFinishedFixtures,
    delayMs: 250,
  });
  console.log("API-Football fixture preload completed:", result);
  await AppDataSource.destroy();
}

main().catch(async (error) => {
  console.error(error);
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(1);
});
