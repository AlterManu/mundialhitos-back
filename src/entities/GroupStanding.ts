import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity("group_standings")
@Unique(["tournament_id", "stage_number", "group_name", "team_id"])
export class GroupStanding {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  tournament_id!: string;

  @Column()
  stage_number!: number;

  @Column()
  stage_name!: string;

  @Column()
  group_name!: string;

  @Column()
  position!: number;

  @Column()
  team_id!: string;

  @Column()
  played!: number;

  @Column()
  wins!: number;

  @Column()
  draws!: number;

  @Column()
  losses!: number;

  @Column()
  goals_for!: number;

  @Column()
  goals_against!: number;

  @Column()
  goal_difference!: number;

  @Column()
  points!: number;

  @Column({ default: false })
  advanced!: boolean;
}
