import { Entity, PrimaryColumn, Column } from "typeorm";

@Entity("matches")
export class Match {
  @PrimaryColumn()
  match_id!: string;

  @Column()
  world_cup_year!: number;

  @Column()
  stage_name!: string;

  @Column({ type: "varchar", nullable: true })
  group_name!: string | null;

  @Column({ default: false })
  must_be_replayed!: boolean;

  @Column({ default: false })
  replay!: boolean;

  @Column()
  date!: string;

  @Column({ type: "varchar", nullable: true })
  time!: string | null;

  @Column()
  stadium_id!: string;

  @Column()
  home_team_id!: string;

  @Column()
  away_team_id!: string;

  @Column()
  home_score!: number;

  @Column()
  away_score!: number;

  @Column({ type: "integer", nullable: true })
  home_score_margin!: number | null;

  @Column({ type: "integer", nullable: true })
  away_score_margin!: number | null;

  @Column({ default: false })
  extra_time!: boolean;

  @Column({ default: false })
  penalties!: boolean;

  @Column({ type: "integer", nullable: true })
  home_penalty_score!: number | null;

  @Column({ type: "integer", nullable: true })
  away_penalty_score!: number | null;

  @Column()
  winner!: string;
}
