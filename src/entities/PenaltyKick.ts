import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("penalty_kicks")
export class PenaltyKick {
  @PrimaryColumn()
  penalty_kick_id!: string;

  @Column()
  tournament_id!: string;

  @Column()
  match_id!: string;

  @Column()
  team_id!: string;

  @Column()
  player_id!: string;

  @Column({ default: false })
  converted!: boolean;
}
