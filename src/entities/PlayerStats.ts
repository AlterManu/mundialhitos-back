import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("player_stats")
export class PlayerStats {
  @PrimaryColumn()
  player_id!: string;

  @Column({ type: "integer", default: 0 })
  world_cup_goals: number = 0;

  @Column({ type: "integer", default: 0 })
  own_goals: number = 0;

  @Column({ type: "integer", default: 0 })
  penalties_scored: number = 0;

  @Column({ type: "integer", default: 0 })
  appearances: number = 0;

  @Column({ type: "integer", default: 0 })
  starts: number = 0;

  @Column({ type: "integer", default: 0 })
  tournaments_played: number = 0;

  @Column({ type: "integer", default: 0 })
  yellow_cards: number = 0;

  @Column({ type: "integer", default: 0 })
  red_cards: number = 0;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  extra: Record<string, unknown> = {};
}
