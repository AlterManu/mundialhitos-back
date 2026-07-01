import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity("team_opponent_stats")
@Unique(["team_id", "opponent_team_id"])
export class TeamOpponentStats {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  team_id!: string;

  @Column()
  opponent_team_id!: string;

  @Column({ type: "integer", default: 0 })
  matches: number = 0;

  @Column({ type: "integer", default: 0 })
  wins: number = 0;

  @Column({ type: "integer", default: 0 })
  draws: number = 0;

  @Column({ type: "integer", default: 0 })
  losses: number = 0;

  @Column({ type: "integer", default: 0 })
  goals_for: number = 0;

  @Column({ type: "integer", default: 0 })
  goals_against: number = 0;
}
