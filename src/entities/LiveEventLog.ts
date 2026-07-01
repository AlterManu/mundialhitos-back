import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

export enum LiveEventKind {
  GoalScored = "goal_scored",
  CardShown = "card_shown",
  SubstitutionMade = "substitution_made",
  LineupConfirmed = "lineup_confirmed",
  MatchStatusChanged = "match_status_changed",
  StatisticChanged = "statistic_changed",
  VarDecision = "var_decision",
}

export enum LiveEventProcessingStatus {
  Pending = "pending",
  Processed = "processed",
  Ignored = "ignored",
  Failed = "failed",
}

@Entity("live_event_log")
@Unique(["provider", "provider_event_id"])
export class LiveEventLog {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  provider!: string;

  @Column()
  provider_event_id!: string;

  @Column({ type: "varchar" })
  kind!: LiveEventKind;

  @Column()
  match_id!: string;

  @Column({ type: "varchar", nullable: true })
  team_id!: string | null;

  @Column({ type: "varchar", nullable: true })
  player_id!: string | null;

  @Column({ type: "varchar", nullable: true })
  opponent_id!: string | null;

  @Column({ type: "integer", nullable: true })
  minute!: number | null;

  @Column({ type: "integer", nullable: true })
  additional_minute!: number | null;

  @Column({ default: 0 })
  sequence_number!: number;

  @Column({ type: "jsonb" })
  payload!: Record<string, unknown>;

  @Column({ type: "varchar", default: LiveEventProcessingStatus.Pending })
  status!: LiveEventProcessingStatus;

  @Column({ type: "text", nullable: true })
  error_message!: string | null;

  @CreateDateColumn()
  created_at!: Date;
}
