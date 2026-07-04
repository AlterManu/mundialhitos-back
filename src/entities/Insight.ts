import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

export enum InsightStatus {
  Candidate = "candidate",
  Published = "published",
  Discarded = "discarded",
}

export enum InsightScope {
  Player = "player",
  Team = "team",
  Match = "match",
  Tournament = "tournament",
  HeadToHead = "head_to_head",
}

export enum InsightPhase {
  PreMatch = "pre_match",
  Live = "live",
  PostMatch = "post_match",
}

@Entity("insights")
@Unique(["dedupe_key"])
export class Insight {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  type!: string;

  @Column({ type: "varchar", default: InsightPhase.Live })
  phase!: InsightPhase;

  @Column({ type: "varchar" })
  scope!: InsightScope;

  @Column()
  subject_id!: string;

  @Column()
  match_id!: string;

  @Column({ type: "varchar", nullable: true })
  event_log_id!: string | null;

  @Column()
  dedupe_key!: string;

  @Column({ type: "float" })
  importance_score!: number;

  @Column()
  title!: string;

  @Column({ type: "text" })
  body!: string;

  @Column({ type: "jsonb" })
  facts!: Record<string, unknown>;

  @Column({ type: "varchar", default: InsightStatus.Candidate })
  status!: InsightStatus;

  @CreateDateColumn()
  created_at!: Date;
}
