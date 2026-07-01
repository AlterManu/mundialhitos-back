import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("match_state_snapshots")
export class MatchStateSnapshot {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  match_id!: string;

  @Column({ type: "varchar", nullable: true })
  event_log_id!: string | null;

  @Column({ default: 0 })
  home_goals!: number;

  @Column({ default: 0 })
  away_goals!: number;

  @Column({ type: "varchar", nullable: true })
  status!: string | null;

  @Column({ type: "integer", nullable: true })
  minute!: number | null;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  live_statistics!: Record<string, unknown>;

  @CreateDateColumn()
  created_at!: Date;
}
