import { Entity, PrimaryColumn, Column } from "typeorm";

@Entity("players")
export class Player {
  @PrimaryColumn()
  player_id!: string;

  @Column({ type: "varchar", nullable: true })
  name!: string | null;

  @Column({ type: "varchar", nullable: true })
  lastname!: string | null;

  @Column()
  birth_date!: boolean;

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

  @Column()
  list_tournaments!: string;

  @Column({ nullable: true })
  goals!: number;

  @Column({ nullable: true })
  own_goals!: number;

  @Column({ nullable: true })
  penalties_scored!: number;
}
