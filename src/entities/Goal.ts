import { Entity, PrimaryColumn, Column } from "typeorm";

@Entity("goals")
export class Goal {
  @PrimaryColumn()
  goal_id!: string;

  @PrimaryColumn()
  world_cup_year!: number;

  @Column()
  match_id!: string;

  @Column()
  team_id!: string;

  @Column()
  scored_by_player!: string;

  @Column({ nullable: true })
  scored_vs_team!: string;

  @Column()
  shirt_number!: number;

  @Column()
  minute!: number;

  @Column()
  additional_minute!: number;

  @Column()
  match_period!: string;

  @Column()
  own_goal!: boolean;

  @Column()
  penalty!: boolean;
}
