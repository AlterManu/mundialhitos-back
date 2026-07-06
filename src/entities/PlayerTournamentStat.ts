import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity("player_tournament_stats")
@Unique(["world_cup_year", "player_id"])
export class PlayerTournamentStat {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  tournament_id!: string;

  @Column({ type: "integer" })
  world_cup_year!: number;

  @Column()
  player_id!: string;

  @Column({ type: "integer", default: 0 })
  goals: number = 0;

  @Column({ type: "integer", default: 0 })
  assists: number = 0;

  @Column({ type: "integer", default: 0 })
  yellow_cards: number = 0;

  @Column({ type: "integer", default: 0 })
  red_cards: number = 0;
}
