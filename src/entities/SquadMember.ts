import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity("squad_members")
@Unique(["world_cup_year", "team_id", "player_id"])
export class SquadMember {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  world_cup_year!: number;

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
}
