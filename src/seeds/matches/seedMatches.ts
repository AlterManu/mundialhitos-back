import "reflect-metadata";
import dotenv from "dotenv";
dotenv.config();

import * as XLSX from "xlsx";
import path from "path";
import { AppDataSource } from "../../config/dataSource";
import { Match } from "../../entities/Match";

const binaryConverter = (data: string) => {
  if (data === "1") return true;
  return false;
};

const getWinner = (winner: string, homeId: string, awayId: string) => {
  if (winner === "home team win") return homeId;
  if (winner === "away team win") return awayId;
  return "0";
};

async function seed() {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(Match);

  const filePath = path.join(__dirname, "./matches.csv");
  const workbook = XLSX.readFile(filePath, { type: "file" });

  if (!workbook.SheetNames.length) {
    console.error("Excel sheet not found in the file.");
    return;
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]!];
  const rows = XLSX.utils.sheet_to_json(sheet!);

  console.log(`${rows.length} rows found`);

  for (const row of rows as any[]) {
    const match = repo.create({
      match_id: row.match_id,
      world_cup_year: row.world_cup_year,
      stage_name: row.stage_name,
      group_name: row.group_name ?? null,
      must_be_replayed: binaryConverter(row.must_be_replayed),
      replay: binaryConverter(row.replay),
      date: row.date,
      time: row.time ?? null,
      stadium_id: row.stadium_id,
      home_team_id: row.home_team_id,
      away_team_id: row.away_team_id,
      home_score: row.home_score,
      away_score: row.away_score,
      home_score_margin: row.home_score_margin ?? null,
      away_score_margin: row.away_score_margin ?? null,
      extra_time: Boolean(row.extra_time),
      penalties: Boolean(row.penalties),
      home_penalty_score: row.home_penalty_score ?? null,
      away_penalty_score: row.away_penalty_score ?? null,
      winner: getWinner(row.winner, row.home_team_id, row.away_team_id),
    });
    await repo.save(match);
  }

  console.log("Seed completed");
  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error("Error in seed:", err);
  process.exit(1);
});
