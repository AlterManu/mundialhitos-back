import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

export enum PlayerStatMetric {
  Goals = "goals",
  Assists = "assists",
  YellowCards = "yellow_cards",
  RedCards = "red_cards",
  PenaltiesScored = "penalties_scored",
}

export enum PlayerStatRankingScope {
  AllTime = "all_time",
  Tournament = "tournament",
  NationalAllTime = "national_all_time",
}

@Entity("player_stat_rankings")
@Unique(["metric", "scope", "team_id", "world_cup_year", "player_id"])
export class PlayerStatRanking {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar" })
  metric!: PlayerStatMetric;

  @Column({ type: "varchar" })
  scope!: PlayerStatRankingScope;

  @Column({ type: "varchar", nullable: true })
  team_id!: string | null;

  @Column({ type: "integer", nullable: true })
  world_cup_year!: number | null;

  @Column()
  player_id!: string;

  @Column({ type: "integer", default: 0 })
  value: number = 0;

  @Column({ type: "integer" })
  rank_position!: number;
}
