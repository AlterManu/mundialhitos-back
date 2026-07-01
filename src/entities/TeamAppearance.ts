import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity("team_appearances")
@Unique(["match_id", "team_id"])
export class TeamAppearance {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  tournament_id!: string;

  @Column()
  match_id!: string;

  @Column()
  team_id!: string;

  @Column()
  opponent_id!: string;

  @Column({ default: false })
  home_team!: boolean;

  @Column({ default: false })
  away_team!: boolean;

  @Column({ default: 0 })
  goals_for!: number;

  @Column({ default: 0 })
  goals_against!: number;

  @Column({ default: 0 })
  goal_differential!: number;

  @Column({ default: false })
  extra_time!: boolean;

  @Column({ default: false })
  penalty_shootout!: boolean;

  @Column({ default: false })
  win!: boolean;

  @Column({ default: false })
  lose!: boolean;

  @Column({ default: false })
  draw!: boolean;
}
