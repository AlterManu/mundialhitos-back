import { Entity, PrimaryColumn, Column } from "typeorm";

@Entity("players")
export class Player {
  @PrimaryColumn()
  player_id!: string;

  @Column({ type: "varchar", nullable: true })
  name!: string | null;

  @Column({ type: "varchar", nullable: true })
  lastname!: string | null;

  @Column({ type: "date", nullable: true })
  birth_date!: string | null;

  @Column()
  goal_keeper!: boolean;

  @Column()
  defender!: boolean;

  @Column()
  midfielder!: boolean;

  @Column()
  forward!: boolean;

  @Column()
  count_tournaments!: number;

  @Column({ type: "text", default: "" })
  list_tournaments!: string;

  @Column({ type: "integer", nullable: true })
  goals!: number;

  @Column({ type: "integer", nullable: true })
  own_goals!: number;

  @Column({ type: "integer", nullable: true })
  penalties_scored!: number;
}
