import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("world_cups")
export class WorldCup {
  @PrimaryColumn()
  tournament_id!: string;

  @Column()
  name!: string;

  @Column()
  year!: number;

  @Column({ type: "date", nullable: true })
  start_date!: string | null;

  @Column({ type: "date", nullable: true })
  end_date!: string | null;

  @Column({ nullable: true })
  host_country!: string | null;

  @Column({ nullable: true })
  winner_team_id!: string | null;

  @Column({ default: 0 })
  count_teams!: number;
}
