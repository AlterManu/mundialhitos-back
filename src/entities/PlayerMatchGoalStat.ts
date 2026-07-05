import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity("player_match_goal_stats")
@Unique(["match_id", "player_id"])
export class PlayerMatchGoalStat {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  tournament_id!: string;

  @Column()
  world_cup_year!: number;

  @Column()
  match_id!: string;

  @Column()
  player_id!: string;

  @Column()
  team_id!: string;

  @Column({ type: "varchar", nullable: true })
  opponent_team_id!: string | null;

  @Column()
  stage_name!: string;

  @Column({ type: "date", nullable: true })
  match_date!: string | null;

  @Column({ type: "integer", default: 0 })
  goals: number = 0;

  @Column({ type: "integer", default: 0 })
  penalties_scored: number = 0;

  @Column({ type: "integer", default: 0 })
  own_goals: number = 0;
}
