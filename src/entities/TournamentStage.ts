import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity("tournament_stages")
@Unique(["tournament_id", "stage_number", "stage_name"])
export class TournamentStage {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  tournament_id!: string;

  @Column()
  stage_number!: number;

  @Column()
  stage_name!: string;

  @Column({ default: false })
  group_stage!: boolean;

  @Column({ default: false })
  knockout_stage!: boolean;

  @Column({ type: "date", nullable: true })
  start_date!: string | null;

  @Column({ type: "date", nullable: true })
  end_date!: string | null;
}
