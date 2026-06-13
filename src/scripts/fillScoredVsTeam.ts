import "reflect-metadata";
import dotenv from "dotenv";
dotenv.config();

import { AppDataSource } from "../config/dataSource";
import { Goal } from "../entities/Goal";
import { Match } from "../entities/Match";

async function fill() {
  await AppDataSource.initialize();

  const goalRepo = AppDataSource.getRepository(Goal);
  const matchRepo = AppDataSource.getRepository(Match);

  const goals = await goalRepo.find();
  console.log(`${goals.length} goals found`);

  let updated = 0;
  let skipped = 0;

  for (const goal of goals) {
    const match = await matchRepo.findOneBy({ match_id: goal.match_id });

    if (!match) {
      console.warn(`No match found for ${goal.match_id}`);
      console.warn(`for goal id: ${goal.goal_id})`);
      skipped++;
      continue;
    }

    if (goal.team_id === match.home_team_id) {
      goal.scored_vs_team = match.away_team_id;
    } else if (goal.team_id === match.away_team_id) {
      goal.scored_vs_team = match.home_team_id;
    } else {
      console.warn(
        `team_id ${goal.team_id} does not match either team in match ${goal.match_id}`,
      );
      skipped++;
      continue;
    }

    await goalRepo.save(goal);
    updated++;
  }

  console.log(`Completed: ${updated} updated, ${skipped} skipped`);
  await AppDataSource.destroy();
}

fill().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
