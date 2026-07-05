import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity("goalkeeper_tournament_stats")
@Unique(["world_cup_year", "player_id"])
export class GoalkeeperTournamentStat {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  tournament_id!: string;

  @Column()
  world_cup_year!: number;

  @Column()
  player_id!: string;

  @Column()
  team_id!: string;

  @Column({ type: "integer", default: 0 })
  appearances: number = 0;

  @Column({ type: "integer", default: 0 })
  clean_sheets: number = 0;

  @Column({ type: "integer", default: 0 })
  goals_conceded: number = 0;
}
