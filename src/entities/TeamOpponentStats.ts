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

  @Column({ default: 0 })
  matches!: number;

  @Column({ default: 0 })
  wins!: number;

  @Column({ default: 0 })
  draws!: number;

  @Column({ default: 0 })
  losses!: number;

  @Column({ default: 0 })
  goals_for!: number;

  @Column({ default: 0 })
  goals_against!: number;
}
