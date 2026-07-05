import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

export enum PlayerGoalRankingScope {
  AllTime = "all_time",
  Tournament = "tournament",
}

@Entity("player_goal_rankings")
@Unique(["scope", "world_cup_year", "player_id"])
export class PlayerGoalRanking {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar" })
  scope!: PlayerGoalRankingScope;

  @Column({ type: "integer", nullable: true })
  world_cup_year!: number | null;

  @Column()
  player_id!: string;

  @Column({ type: "integer", default: 0 })
  goals: number = 0;

  @Column({ type: "integer" })
  rank_position!: number;
}
