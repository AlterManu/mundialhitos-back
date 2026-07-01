import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("player_stats")
export class PlayerStats {
  @PrimaryColumn()
  player_id!: string;

  @Column({ default: 0 })
  world_cup_goals!: number;

  @Column({ default: 0 })
  own_goals!: number;

  @Column({ default: 0 })
  penalties_scored!: number;

  @Column({ default: 0 })
  appearances!: number;

  @Column({ default: 0 })
  starts!: number;

  @Column({ default: 0 })
  tournaments_played!: number;

  @Column({ default: 0 })
  yellow_cards!: number;

  @Column({ default: 0 })
  red_cards!: number;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  extra!: Record<string, unknown>;
}
