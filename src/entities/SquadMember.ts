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

  @Column({ nullable: true })
  shirt_number!: number | null;

  @Column({ nullable: true })
  position_name!: string | null;

  @Column({ nullable: true })
  position_code!: string | null;
}
