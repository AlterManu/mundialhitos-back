import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

export enum ExternalProvider {
  ApiFootball = "api-football",
}

export enum MappedEntityType {
  Team = "team",
  Player = "player",
  Match = "match",
  Tournament = "tournament",
  Venue = "venue",
}

@Entity("external_id_mappings")
@Unique(["provider", "entity_type", "external_id"])
@Unique(["provider", "entity_type", "local_id"])
export class ExternalIdMapping {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar" })
  provider!: ExternalProvider;

  @Column({ type: "varchar" })
  entity_type!: MappedEntityType;

  @Column()
  external_id!: string;

  @Column()
  local_id!: string;

  @Column({ type: "jsonb", nullable: true })
  metadata!: Record<string, unknown> | null;
}
