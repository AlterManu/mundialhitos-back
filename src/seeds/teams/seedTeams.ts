import "reflect-metadata";
import dotenv from "dotenv";
dotenv.config();

import * as XLSX from "xlsx";
import path from "path";
import { AppDataSource } from "../../config/dataSource";
import { Team } from "../../entities/Team";

async function seed() {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(Team);

  const filePath = path.join(__dirname, "./teams.csv");
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
      team_id: row.team_id,
      name_en: row.name_en,
      team_code_en: row.team_code_en,
      confederation_id: row.confederation_id,
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
