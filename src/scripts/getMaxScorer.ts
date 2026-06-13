import "reflect-metadata";
import dotenv from "dotenv";
dotenv.config();

import { AppDataSource } from "../config/dataSource";
import { Player } from "../entities/Player";

async function getMaxScorer() {
  await AppDataSource.initialize();

  const playerRepo = AppDataSource.getRepository(Player);
  const players = await playerRepo.find();

  const scorers = [];

  for (const player of players) {
    if (player?.goals > 0) {
      scorers.push(player);
    }
  }

  const top20Scorers = scorers
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 20)
    .map((player) => ({
      player_id: player.player_id,
      name: `${player.name ? `${player.name} ` : ""}${player.lastname || ""}`,
      goals: player.goals,
    }));

  console.log("Top 20 Scorers:", top20Scorers);
}

getMaxScorer();
