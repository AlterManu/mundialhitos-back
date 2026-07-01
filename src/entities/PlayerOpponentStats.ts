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

  @Column({ default: 0 })
  goals!: number;

  @Column({ default: 0 })
  penalties_scored!: number;

  @Column({ default: 0 })
  matches!: number;
}
