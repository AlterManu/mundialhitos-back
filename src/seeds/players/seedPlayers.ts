import "reflect-metadata";
import dotenv from "dotenv";
dotenv.config();

import * as XLSX from "xlsx";
import path from "path";
import { AppDataSource } from "../../config/dataSource";
import { Player } from "../../entities/Player";

const binaryConverter = (data: string) => {
  if (data === "1") return true;
  return false;
};

async function seed() {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(Player);

  const filePath = path.join(__dirname, "./players.csv");
  const workbook = XLSX.readFile(filePath, { type: "file" });

  if (!workbook.SheetNames.length) {
    console.error("Excel sheet not found in the file.");
    return;
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]!];
  const rows = XLSX.utils.sheet_to_json(sheet!);

  console.log(`${rows.length} rows found`);

  for (const row of rows as any[]) {
    const team = repo.create({
      player_id: row.player_id,
      name: row.name,
      lastname: row.lastname,
      // TODO: fix the birth_date and the positions
      birth_date: row.birth_date,
      goal_keeper: binaryConverter(row.goal_keeper),
      defender: binaryConverter(row.defender),
      midfielder: binaryConverter(row.midfielder),
      forward: binaryConverter(row.forward),
      count_tournaments: row.count_tournaments,
      list_tournaments: row.list_tournaments,
    });
    await repo.save(team);
  }

  console.log("Seed completed");
  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error("Error in seed:", err);
  process.exit(1);
});
