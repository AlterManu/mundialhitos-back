import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity("player_opponent_stats")
@Unique(["player_id", "opponent_team_id"])
export class PlayerOpponentStats {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  player_id!: string;

  @Column()
  opponent_team_id!: string;

  @Column({ type: "integer", default: 0 })
  goals: number = 0;

  @Column({ type: "integer", default: 0 })
  penalties_scored: number = 0;

  @Column({ type: "integer", default: 0 })
  matches: number = 0;
}
