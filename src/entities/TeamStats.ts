import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("team_stats")
export class TeamStats {
  @PrimaryColumn()
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
  tournaments_played: number = 0;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  extra: Record<string, unknown> = {};
}
