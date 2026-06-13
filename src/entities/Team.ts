import { Entity, PrimaryColumn, Column } from "typeorm";

@Entity("teams")
export class Team {
  @PrimaryColumn()
  team_id!: string;

  @Column()
  name_en!: string;

  @Column()
  team_code_en!: string;

  @Column()
  confederation_id!: string;
}
