import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity("tournament_standings")
@Unique(["tournament_id", "team_id"])
export class TournamentStanding {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  tournament_id!: string;

  @Column()
  position!: number;

  @Column()
  team_id!: string;
}
