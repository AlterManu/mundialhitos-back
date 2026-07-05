import { DataSource, Like, Repository } from "typeorm";
import {
  ExternalIdMapping,
  ExternalProvider,
  MappedEntityType,
} from "@/entities/ExternalIdMapping";
import { Player } from "@/entities/Player";
import {
  normalizeName,
  splitPersonName,
} from "@/application/mapping/NameNormalizer";

const ONE_NAME_PLAYER_TEAM_IDS = new Set(["T-09", "T-70", "T-56"]);

export interface ReclassifyCreatedPlayersResult {
  scanned: number;
  updated: number;
  high: number;
  medium: number;
  low: number;
}

export class ApiFootballMappingMaintenanceService {
  private readonly mappingRepo: Repository<ExternalIdMapping>;
  private readonly playerRepo: Repository<Player>;

  constructor(private readonly dataSource: DataSource) {
    this.mappingRepo = dataSource.getRepository(ExternalIdMapping);
    this.playerRepo = dataSource.getRepository(Player);
  }

  async reclassifyCreatedPlayerMappings(): Promise<ReclassifyCreatedPlayersResult> {
    const mappings = await this.mappingRepo.find({
      where: {
        provider: ExternalProvider.ApiFootball,
        entity_type: MappedEntityType.Player,
        local_id: Like("P-AF-%"),
      },
      order: { external_id: "ASC" },
    });

    const result: ReclassifyCreatedPlayersResult = {
      scanned: mappings.length,
      updated: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    for (const mapping of mappings) {
      const player = await this.playerRepo.findOneBy({
        player_id: mapping.local_id,
      });
      const metadata = isRecord(mapping.metadata) ? mapping.metadata : {};
      const aliases = collectAliases(metadata, player);
      const bestName = chooseBestName(aliases);
      const localTeamId =
        typeof metadata.localTeamId === "string" ? metadata.localTeamId : null;
      const confidence = confidenceForCreatedPlayer(bestName, localTeamId);
      const oneNamePlayer = isTrustedOneNamePlayer(bestName, localTeamId);

      if (confidence === "high") result.high += 1;
      if (confidence === "medium") result.medium += 1;
      if (confidence === "low") result.low += 1;

      if (player && bestName) {
        await this.enrichPlayer(player, bestName, oneNamePlayer);
      }

      const nextMetadata = {
        ...metadata,
        status: "created",
        confidence,
        strategy: oneNamePlayer
          ? "created_from_api_one_name_player_backfill"
          : confidence === "low"
            ? "created_from_api_player_needs_review_backfill"
            : "created_from_api_player_identity_backfill",
        apiName: bestName || metadata.apiName || metadata.localName || null,
        localName: bestName || metadata.localName || metadata.apiName || null,
        aliases,
        reclassifiedAt: new Date().toISOString(),
      };

      if (JSON.stringify(metadata) !== JSON.stringify(nextMetadata)) {
        mapping.metadata = nextMetadata;
        await this.mappingRepo.save(mapping);
        result.updated += 1;
      }
    }

    return result;
  }

  private async enrichPlayer(
    player: Player,
    bestName: string,
    oneNamePlayer: boolean,
  ) {
    if (oneNamePlayer) {
      if (player.name !== bestName || player.lastname !== null) {
        player.name = bestName;
        player.lastname = null;
        await this.playerRepo.save(player);
      }
      return;
    }

    const currentName = fullPlayerName(player);
    if (nameQuality(currentName) >= nameQuality(bestName)) return;

    const nameParts = splitPersonName(bestName);
    player.name = nameParts.name;
    player.lastname = nameParts.lastname;
    await this.playerRepo.save(player);
  }
}

function collectAliases(
  metadata: Record<string, unknown>,
  player: Player | null,
): string[] {
  const aliases = new Set<string>();

  if (Array.isArray(metadata.aliases)) {
    for (const alias of metadata.aliases) {
      if (typeof alias === "string" && alias.trim()) aliases.add(alias.trim());
    }
  }

  for (const key of ["apiName", "localName"]) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) aliases.add(value.trim());
  }

  if (player) {
    const playerName = fullPlayerName(player);
    if (playerName) aliases.add(playerName);
  }

  return [...aliases];
}

function chooseBestName(aliases: string[]): string | null {
  return aliases.sort((a, b) => nameQuality(b) - nameQuality(a))[0] ?? null;
}

function confidenceForCreatedPlayer(
  name: string | null,
  localTeamId: string | null,
): "high" | "medium" | "low" {
  if (!name) return "low";
  if (isTrustedOneNamePlayer(name, localTeamId)) return "high";
  if (hasFullPersonName(name)) return "high";
  if (isAbbreviatedPersonName(name)) return "medium";
  return "low";
}

function isTrustedOneNamePlayer(
  name: string | null,
  localTeamId: string | null,
): boolean {
  if (!name || !localTeamId || !ONE_NAME_PLAYER_TEAM_IDS.has(localTeamId)) {
    return false;
  }

  const tokens = normalizeName(name).split(" ").filter(Boolean);
  return tokens.length === 1 && (tokens[0]?.length ?? 0) > 1;
}

function hasFullPersonName(value: string): boolean {
  const tokens = normalizeName(value).split(" ").filter(Boolean);
  return tokens.length >= 2 && (tokens[0]?.length ?? 0) > 1;
}

function isAbbreviatedPersonName(value: string): boolean {
  const tokens = normalizeName(value).split(" ").filter(Boolean);
  return tokens.length >= 2 && (tokens[0]?.length ?? 0) === 1;
}

function nameQuality(value: string): number {
  const tokens = normalizeName(value).split(" ").filter(Boolean);
  const firstToken = tokens[0] ?? "";
  return (
    tokens.length * 10 + (firstToken.length > 1 ? 10 : 0) + value.length / 100
  );
}

function fullPlayerName(player: Player): string {
  return `${player.name ?? ""} ${player.lastname ?? ""}`.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
