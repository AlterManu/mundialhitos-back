import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity("team_tournament_stats")
@Unique(["world_cup_year", "team_id"])
export class TeamTournamentStat {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  tournament_id!: string;

  @Column()
  world_cup_year!: number;

  @Column()
  team_id!: string;

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

  @Column({ type: "integer", default: 0 })
  clean_sheets: number = 0;

  @Column({ type: "integer", default: 0 })
  scoreless_matches: number = 0;

  @Column({ default: false })
  reached_knockout: boolean = false;

  @Column({ type: "varchar", nullable: true })
  last_stage_name!: string | null;
}
