import "reflect-metadata";
import dotenv from "dotenv";
dotenv.config();

import { AppDataSource } from "../config/dataSource";
import { Goal } from "../entities/Goal";
import { Player } from "../entities/Player";

async function fill() {
  await AppDataSource.initialize();

  const goalRepo = AppDataSource.getRepository(Goal);
  const playerRepo = AppDataSource.getRepository(Player);

  const goals = await goalRepo.find();
  console.log(`${goals.length} goals found`);

  let updated = 0;
  let skipped = 0;

  for (const goal of goals) {
    const player = await playerRepo.findOneBy({
      player_id: goal.scored_by_player,
    });

    if (!player) {
      console.warn(`No player found for ${goal.scored_by_player}`);
      console.warn(`for goal id: ${goal.goal_id})`);
      skipped++;
      continue;
    }

    if (goal.own_goal) {
      player.own_goals = (player.own_goals || 0) + 1;
    } else {
      player.goals = (player.goals || 0) + 1;
      if (goal.penalty) {
        player.penalties_scored = (player.penalties_scored || 0) + 1;
      }
    }

    await playerRepo.save(player);
    updated++;
  }

  console.log(`Completed: ${updated} updated, ${skipped} skipped`);
  await AppDataSource.destroy();
}

fill().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
