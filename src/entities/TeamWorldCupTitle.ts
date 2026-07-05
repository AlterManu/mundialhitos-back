import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("team_world_cup_titles")
export class TeamWorldCupTitle {
  @PrimaryColumn()
  team_id!: string;

  @Column({ type: "integer", default: 0 })
  titles: number = 0;

  @Column({ type: "integer", array: true, default: () => "'{}'::integer[]" })
  years: number[] = [];
}
