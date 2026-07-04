import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

@Entity("api_football_fixtures")
export class ApiFootballFixture {
  @PrimaryColumn()
  internal_match_id!: string;

  @Column({ unique: true })
  api_fixture_id!: string;

  @Column()
  league_id!: number;

  @Column()
  season!: number;

  @Column({ type: "varchar", nullable: true })
  round!: string | null;

  @Column()
  kickoff_at!: string;

  @Column({ type: "varchar", nullable: true })
  venue_name!: string | null;

  @Column({ type: "varchar", nullable: true })
  venue_city!: string | null;

  @Column()
  status_long!: string;

  @Column()
  status_short!: string;

  @Column({ type: "integer", nullable: true })
  elapsed!: number | null;

  @Column()
  home_api_team_id!: string;

  @Column()
  home_team_name!: string;

  @Column({ type: "varchar", nullable: true })
  home_local_team_id!: string | null;

  @Column()
  away_api_team_id!: string;

  @Column()
  away_team_name!: string;

  @Column({ type: "varchar", nullable: true })
  away_local_team_id!: string | null;

  @Column({ type: "integer", nullable: true })
  home_goals!: number | null;

  @Column({ type: "boolean", nullable: true })
  home_winner!: boolean | null;

  @Column({ type: "integer", nullable: true })
  away_goals!: number | null;

  @Column({ type: "boolean", nullable: true })
  away_winner!: boolean | null;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  score!: Record<string, unknown>;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  raw_fixture!: Record<string, unknown>;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
