import "reflect-metadata";
import dotenv from "dotenv";
dotenv.config();

import { AppDataSource } from "../config/dataSource";
import { Player } from "../entities/Player";

async function fixNames() {
  await AppDataSource.initialize();
  const playerRepo = AppDataSource.getRepository(Player);
  const players = await playerRepo.find();

  for (const player of players) {
    if (player.lastname === "not applicable") {
      player.lastname = null;
    } else {
      const fixedName = Buffer.from(player.lastname!, "latin1").toString(
        "utf8",
      );
      if (fixedName !== player.lastname) {
        console.log(
          `Fixing name for player ${player.player_id}: ${player.lastname} -> ${fixedName}`,
        );
        player.lastname = fixedName;
      }
    }
    await playerRepo.save(player);
  }
  await AppDataSource.destroy();
}

fixNames().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
