import { DataSource, Repository } from "typeorm";
import {
  ExternalIdMapping,
  ExternalProvider,
  MappedEntityType,
} from "@/entities/ExternalIdMapping";

export class ExternalIdMappingResolver {
  private readonly mappingRepo: Repository<ExternalIdMapping>;

  constructor(dataSource: DataSource) {
    this.mappingRepo = dataSource.getRepository(ExternalIdMapping);
  }

  async resolve(
    entityType: MappedEntityType,
    externalId: number | string | null,
  ): Promise<string | null> {
    if (externalId === null) return null;

    const mapping = await this.mappingRepo.findOneBy({
      provider: ExternalProvider.ApiFootball,
      entity_type: entityType,
      external_id: String(externalId),
    });

    return mapping?.local_id ?? null;
  }
}
