import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("venues")
export class Venue {
  @PrimaryColumn()
  venue_id!: string;

  @Column()
  name!: string;

  @Column({ type: "varchar", nullable: true })
  city!: string | null;

  @Column({ type: "varchar", nullable: true })
  country!: string | null;

  @Column({ type: "varchar", default: "local" })
  source!: string;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;
}
