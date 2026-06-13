import "reflect-metadata";
import dotenv from "dotenv";
dotenv.config();

import * as XLSX from "xlsx";
import path from "path";
import { AppDataSource } from "../../config/dataSource";
import { Goal } from "../../entities/Goal";

const binaryConverter = (data: string) => {
  if (data === "1") return true;
  return false;
};

async function seed() {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(Goal);

  const filePath = path.join(__dirname, "./goals.csv");
  const workbook = XLSX.readFile(filePath, { type: "file" });

  if (!workbook.SheetNames.length) {
    console.error("Excel sheet not found in the file.");
    return;
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]!];
  const rows = XLSX.utils.sheet_to_json(sheet!);

  console.log(`${rows.length} rows found`);

  for (const row of rows as any[]) {
    const goal = repo.create({
      goal_id: row.goal_id,
      world_cup_year: row.world_cup_year,
      match_id: row.match_id,
      team_id: row.team_id,
      scored_by_player: row.scored_by_player,
      shirt_number: row.shirt_number,
      minute: row.minute,
      additional_minute: row.additional_minute,
      match_period: row.match_period,
      own_goal: binaryConverter(row.own_goal),
      penalty: binaryConverter(row.penalty),
    });
    await repo.save(goal);
  }

  console.log("Seed completed");
  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error("Error in seed:", err);
  process.exit(1);
});
