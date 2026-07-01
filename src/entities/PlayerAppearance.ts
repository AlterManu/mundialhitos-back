import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity("player_appearances")
@Unique(["match_id", "team_id", "player_id"])
export class PlayerAppearance {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  tournament_id!: string;

  @Column()
  match_id!: string;

  @Column()
  team_id!: string;

  @Column()
  player_id!: string;

  @Column({ type: "integer", nullable: true })
  shirt_number!: number | null;

  @Column({ type: "varchar", nullable: true })
  position_name!: string | null;

  @Column({ type: "varchar", nullable: true })
  position_code!: string | null;

  @Column({ default: false })
  starter!: boolean;

  @Column({ default: false })
  substitute!: boolean;

  @Column({ default: false })
  captain!: boolean;
}
