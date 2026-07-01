import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("team_stats")
export class TeamStats {
  @PrimaryColumn()
  team_id!: string;

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

  @Column({ default: 0 })
  clean_sheets!: number;

  @Column({ default: 0 })
  tournaments_played!: number;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  extra!: Record<string, unknown>;
}
