import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("substitutions")
export class Substitution {
  @PrimaryColumn()
  substitution_id!: string;

  @Column()
  tournament_id!: string;

  @Column()
  match_id!: string;

  @Column()
  team_id!: string;

  @Column()
  player_id!: string;

  @Column()
  minute!: number;

  @Column({ default: 0 })
  additional_minute!: number;

  @Column()
  match_period!: string;

  @Column({ default: false })
  going_off!: boolean;

  @Column({ default: false })
  coming_on!: boolean;
}
