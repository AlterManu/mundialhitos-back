import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("assists")
export class Assist {
  @PrimaryColumn()
  assist_id!: string;

  @Column()
  tournament_id!: string;

  @Column()
  match_id!: string;

  @Column()
  team_id!: string;

  @Column()
  player_id!: string;

  @Column()
  goal_id!: string;
}
