import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity("record_book_entries")
@Unique(["record_key"])
export class RecordBookEntry {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  record_key!: string;

  @Column()
  scope!: string;

  @Column()
  subject_id!: string;

  @Column({ type: "float" })
  value!: number;

  @Column({ nullable: true })
  match_id!: string | null;

  @Column({ nullable: true })
  tournament_id!: string | null;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;
}
