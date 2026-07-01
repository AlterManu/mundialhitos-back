import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("cards")
export class Card {
  @PrimaryColumn()
  card_id!: string;

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
  yellow_card!: boolean;

  @Column({ default: false })
  red_card!: boolean;

  @Column({ default: false })
  second_yellow_card!: boolean;
}
