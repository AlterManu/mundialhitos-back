import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";

export enum PollingStatus {
  Running = "running",
  Stopped = "stopped",
  Failed = "failed",
}

@Entity("fixture_polling_states")
@Unique(["internal_match_id"])
export class FixturePollingState {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  internal_match_id!: string;

  @Column()
  api_fixture_id!: string;

  @Column({ type: "varchar", default: PollingStatus.Stopped })
  status!: PollingStatus;

  @Column({ type: "integer", default: 60 })
  interval_seconds!: number;

  @Column({ type: "timestamp", nullable: true })
  last_polled_at!: Date | null;

  @Column({ type: "timestamp", nullable: true })
  next_poll_at!: Date | null;

  @Column({ type: "text", nullable: true })
  last_error!: string | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
