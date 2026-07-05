import { DataSource, Repository } from "typeorm";
import {
  ApiFootballPlayerCandidate,
  ApiFootballTeamCandidate,
  ApiFootballVenueCandidate,
} from "@/application/mapping/ApiFootballFixtureEntityExtractor";
import {
  compactName,
  initialsAndLastname,
  normalizeName,
  splitPersonName,
  teamCodeFromName,
} from "@/application/mapping/NameNormalizer";
import {
  ExternalIdMapping,
  ExternalProvider,
  MappedEntityType,
} from "@/entities/ExternalIdMapping";
import { Player } from "@/entities/Player";
import { Team } from "@/entities/Team";
import { Venue } from "@/entities/Venue";

export type MappingConfidence = "exact" | "high" | "medium" | "low";
export type MappingStatus = "existing" | "matched" | "created";

export interface ReconciliationResult {
  entityType: MappedEntityType;
  externalId: string;
  localId: string;
  status: MappingStatus;
  confidence: MappingConfidence;
  strategy: string;
  createdEntity: boolean;
}

interface PlayerMatchCandidate {
  player: Player;
  score: number;
  strategy: string;
  matchedAlias: string;
}

interface PlayerReconciliationContext {
  localTeamId?: string | null;
  season?: number | null;
  sameTeamPlayers?: ApiFootballPlayerCandidate[];
}

// Brasil, Spain, and Portugal
const ONE_NAME_PLAYER_TEAM_IDS = new Set(["T-09", "T-70", "T-56"]);

export class ApiFootballEntityReconciler {
  private readonly mappingRepo: Repository<ExternalIdMapping>;
  private readonly playerRepo: Repository<Player>;
  private readonly teamRepo: Repository<Team>;
  private readonly venueRepo: Repository<Venue>;

  constructor(private readonly dataSource: DataSource) {
    this.mappingRepo = dataSource.getRepository(ExternalIdMapping);
    this.playerRepo = dataSource.getRepository(Player);
    this.teamRepo = dataSource.getRepository(Team);
    this.venueRepo = dataSource.getRepository(Venue);
  }

  async reconcileTeam(
    candidate: ApiFootballTeamCandidate,
  ): Promise<ReconciliationResult> {
    const existing = await this.findExistingMapping(
      MappedEntityType.Team,
      candidate.id,
    );
    if (existing) {
      await this.ensureExistingMetadata(existing);
      return this.resultFromExisting(existing, MappedEntityType.Team);
    }

    const localTeam = await this.findLocalTeam(candidate.name);
    if (localTeam) {
      await this.upsertMapping(MappedEntityType.Team, candidate.id, localTeam.team_id, {
        status: "matched",
        confidence: "high",
        strategy: "normalized_team_name",
        apiName: candidate.name,
        localName: localTeam.name_en,
      });

      return {
        entityType: MappedEntityType.Team,
        externalId: String(candidate.id),
        localId: localTeam.team_id,
        status: "matched",
        confidence: "high",
        strategy: "normalized_team_name",
        createdEntity: false,
      };
    }

    const created = await this.createApiTeam(candidate);
    await this.upsertMapping(MappedEntityType.Team, candidate.id, created.team_id, {
      status: "created",
      confidence: "low",
      strategy: "created_from_api_team",
      apiName: candidate.name,
      localName: created.name_en,
    });

    return {
      entityType: MappedEntityType.Team,
      externalId: String(candidate.id),
      localId: created.team_id,
      status: "created",
      confidence: "low",
      strategy: "created_from_api_team",
      createdEntity: true,
    };
  }

  async reconcileVenue(
    candidate: ApiFootballVenueCandidate,
  ): Promise<ReconciliationResult | null> {
    if (candidate.id === null || !candidate.name) return null;

    const existing = await this.findExistingMapping(
      MappedEntityType.Venue,
      candidate.id,
    );
    if (existing) {
      await this.ensureExistingMetadata(existing);
      return this.resultFromExisting(existing, MappedEntityType.Venue);
    }

    const localVenue = await this.findLocalVenue(candidate.name, candidate.city);
    if (localVenue) {
      await this.upsertMapping(MappedEntityType.Venue, candidate.id, localVenue.venue_id, {
        status: "matched",
        confidence: "high",
        strategy: "normalized_venue_name_city",
        apiName: candidate.name,
        apiCity: candidate.city,
        localName: localVenue.name,
        localCity: localVenue.city,
      });

      return {
        entityType: MappedEntityType.Venue,
        externalId: String(candidate.id),
        localId: localVenue.venue_id,
        status: "matched",
        confidence: "high",
        strategy: "normalized_venue_name_city",
        createdEntity: false,
      };
    }

    const created = await this.venueRepo.save(
      this.venueRepo.create({
        venue_id: `V-AF-${candidate.id}`,
        name: candidate.name,
        city: candidate.city,
        country: null,
        source: ExternalProvider.ApiFootball,
        metadata: { apiFootballId: candidate.id },
      }),
    );

    await this.upsertMapping(MappedEntityType.Venue, candidate.id, created.venue_id, {
      status: "created",
      confidence: "low",
      strategy: "created_from_api_venue",
      apiName: candidate.name,
      apiCity: candidate.city,
      localName: created.name,
    });

    return {
      entityType: MappedEntityType.Venue,
      externalId: String(candidate.id),
      localId: created.venue_id,
      status: "created",
      confidence: "low",
      strategy: "created_from_api_venue",
      createdEntity: true,
    };
  }

  async reconcilePlayer(
    candidate: ApiFootballPlayerCandidate,
    context?: PlayerReconciliationContext,
  ): Promise<ReconciliationResult> {
    const existing = await this.findExistingMapping(
      MappedEntityType.Player,
      candidate.id,
    );
    if (existing) {
      await this.ensureProvisionalPlayerMetadata(existing, candidate, context);
      const remapped = await this.remapLowConfidencePlayer(existing, candidate, context);
      if (remapped) return remapped;
      await this.ensureExistingMetadata(existing);
      return this.resultFromExisting(existing, MappedEntityType.Player);
    }

    const playerMatch = await this.findBestPlayerMatch(candidate, context);
    if (playerMatch && playerMatch.score >= 85) {
      const confidence = playerMatch.score >= 100 ? "exact" : "high";
      await this.upsertMapping(
        MappedEntityType.Player,
        candidate.id,
        playerMatch.player.player_id,
        {
          status: "matched",
          confidence,
          strategy: playerMatch.strategy,
          apiName: candidate.name,
          localName: fullPlayerName(playerMatch.player),
          apiTeamId: candidate.apiTeamId,
          localTeamId: context?.localTeamId ?? null,
          season: context?.season ?? null,
          score: playerMatch.score,
        },
      );

      return {
        entityType: MappedEntityType.Player,
        externalId: String(candidate.id),
        localId: playerMatch.player.player_id,
        status: "matched",
        confidence,
        strategy: playerMatch.strategy,
        createdEntity: false,
      };
    }

    const created = await this.createApiPlayer(candidate, context);
    const createdMetadata = createdPlayerMetadata(candidate, created, context, playerMatch);
    await this.upsertMapping(MappedEntityType.Player, candidate.id, created.player_id, {
      ...createdMetadata,
    });

    return {
      entityType: MappedEntityType.Player,
      externalId: String(candidate.id),
      localId: created.player_id,
      status: "created",
      confidence: createdMetadata.confidence,
      strategy: String(createdMetadata.strategy),
      createdEntity: true,
    };
  }

  private async findExistingMapping(
    entityType: MappedEntityType,
    externalId: number | string,
  ) {
    return this.mappingRepo.findOneBy({
      provider: ExternalProvider.ApiFootball,
      entity_type: entityType,
      external_id: String(externalId),
    });
  }

  private resultFromExisting(
    mapping: ExternalIdMapping,
    entityType: MappedEntityType,
  ): ReconciliationResult {
    const metadata = isRecord(mapping.metadata) ? mapping.metadata : {};
    return {
      entityType,
      externalId: mapping.external_id,
      localId: mapping.local_id,
      status: "existing",
      confidence: parseConfidence(metadata.confidence),
      strategy: typeof metadata.strategy === "string" ? metadata.strategy : "existing_mapping",
      createdEntity: false,
    };
  }

  private async ensureExistingMetadata(mapping: ExternalIdMapping) {
    const metadata = isRecord(mapping.metadata) ? mapping.metadata : {};
    if (metadata.confidence && metadata.status && metadata.strategy) return;

    mapping.metadata = {
      ...metadata,
      status: metadata.status ?? "matched",
      confidence: metadata.confidence ?? "high",
      strategy: metadata.strategy ?? "existing_mapping_preserved",
      reconciledAt: metadata.reconciledAt ?? new Date().toISOString(),
    };
    await this.mappingRepo.save(mapping);
  }

  private async findLocalTeam(teamName: string): Promise<Team | null> {
    const teams = await this.teamRepo.find();
    const normalizedApiName = normalizeName(teamName);
    return (
      teams.find((team) => normalizeName(team.name_en) === normalizedApiName) ??
      null
    );
  }

  private async findLocalVenue(
    venueName: string,
    city: string | null,
  ): Promise<Venue | null> {
    const venues = await this.venueRepo.find();
    const normalizedVenueName = normalizeName(venueName);
    const normalizedCity = normalizeName(city);

    return (
      venues.find((venue) => {
        const nameMatches = normalizeName(venue.name) === normalizedVenueName;
        if (!nameMatches) return false;
        if (!normalizedCity) return true;
        return normalizeName(venue.city) === normalizedCity;
      }) ?? null
    );
  }

  private async findBestPlayerMatch(
    candidate: ApiFootballPlayerCandidate,
    context?: PlayerReconciliationContext,
  ): Promise<PlayerMatchCandidate | null> {
    const players = await this.playerRepo.find();
    const scoredCandidates = players
      .filter((player) => !player.player_id.startsWith("P-AF-"))
      .map((player) => scorePlayerCandidate(player, candidate, context))
      .filter((item): item is PlayerMatchCandidate => item !== null)
      .sort((a, b) => b.score - a.score);

    const best = scoredCandidates[0];
    if (!best) return null;

    const secondBest = scoredCandidates[1];
    if (secondBest && best.score === secondBest.score) {
      return {
        player: best.player,
        score: Math.min(best.score, 70),
        strategy: `${best.strategy}_ambiguous`,
        matchedAlias: best.matchedAlias,
      };
    }

    return best;
  }

  private async createApiTeam(candidate: ApiFootballTeamCandidate) {
    return this.teamRepo.save(
      this.teamRepo.create({
        team_id: `T-AF-${candidate.id}`,
        name_en: candidate.name,
        team_code_en: teamCodeFromName(candidate.name),
        confederation_id: "unknown",
      }),
    );
  }

  private async createApiPlayer(
    candidate: ApiFootballPlayerCandidate,
    context?: PlayerReconciliationContext,
  ) {
    const nameParts = playerNameParts(candidate, context);
    const position = normalizeName(candidate.position);

    return this.playerRepo.save(
      this.playerRepo.create({
        player_id: `P-AF-${candidate.id}`,
        name: nameParts.name,
        lastname: nameParts.lastname,
        birth_date: null,
        goal_keeper: position === "g" || position === "goalkeeper",
        defender: position === "d" || position === "defender",
        midfielder: position === "m" || position === "midfielder",
        forward: position === "f" || position === "forward",
        count_tournaments: 0,
        list_tournaments: "",
        goals: 0,
        own_goals: 0,
        penalties_scored: 0,
      }),
    );
  }

  private async remapLowConfidencePlayer(
    existing: ExternalIdMapping,
    candidate: ApiFootballPlayerCandidate,
    context?: PlayerReconciliationContext,
  ): Promise<ReconciliationResult | null> {
    const metadata = isRecord(existing.metadata) ? existing.metadata : {};
    if (!existing.local_id.startsWith("P-AF-")) {
      return null;
    }

    const playerMatch = await this.findBestPlayerMatch(candidate, context);
    if (!playerMatch || playerMatch.score < 85) return null;

    const confidence = playerMatch.score >= 100 ? "exact" : "high";
    const previousLocalId = existing.local_id;
    existing.local_id = playerMatch.player.player_id;
    existing.metadata = {
      ...metadata,
      status: "matched",
      confidence,
      strategy: `${playerMatch.strategy}_remapped_from_provisional`,
      apiName: candidate.name,
      aliases: normalizedAliases(candidate),
      localName: fullPlayerName(playerMatch.player),
      apiTeamId: candidate.apiTeamId,
      localTeamId: context?.localTeamId ?? null,
      season: context?.season ?? null,
      previousLocalId,
      score: playerMatch.score,
      matchedAlias: playerMatch.matchedAlias,
      reconciledAt: new Date().toISOString(),
    };

    await this.mappingRepo.save(existing);
    return {
      entityType: MappedEntityType.Player,
      externalId: existing.external_id,
      localId: playerMatch.player.player_id,
      status: "matched",
      confidence,
      strategy: `${playerMatch.strategy}_remapped_from_provisional`,
      createdEntity: false,
    };
  }

  private async ensureProvisionalPlayerMetadata(
    existing: ExternalIdMapping,
    candidate: ApiFootballPlayerCandidate,
    context?: PlayerReconciliationContext,
  ) {
    if (!existing.local_id.startsWith("P-AF-")) return;

    const metadata = isRecord(existing.metadata) ? existing.metadata : {};
    const player = await this.playerRepo.findOneBy({ player_id: existing.local_id });
    if (player) {
      await this.enrichProvisionalPlayer(player, candidate, context);
    }

    const createdMetadata = createdPlayerMetadata(candidate, player, context, null);
    if (
      metadata.status === createdMetadata.status &&
      metadata.confidence === createdMetadata.confidence &&
      metadata.apiName === createdMetadata.apiName
    ) {
      return;
    }

    existing.metadata = { ...metadata, ...createdMetadata, correctedAt: new Date().toISOString() };

    await this.mappingRepo.save(existing);
  }

  private async enrichProvisionalPlayer(
    player: Player,
    candidate: ApiFootballPlayerCandidate,
    context?: PlayerReconciliationContext,
  ) {
    const bestName = chooseBestCandidateName(candidate);
    if (isTrustedOneNamePlayer(bestName, context)) {
      if (player.name !== bestName || player.lastname !== null) {
        player.name = bestName;
        player.lastname = null;
        applyPositionFlags(player, candidate.position);
        await this.playerRepo.save(player);
      }
      return;
    }

    const currentName = fullPlayerName(player);
    if (apiPlayerNameQuality(currentName) >= apiPlayerNameQuality(bestName)) return;

    const nameParts = splitPersonName(bestName);
    player.name = nameParts.name;
    player.lastname = nameParts.lastname;
    applyPositionFlags(player, candidate.position);
    await this.playerRepo.save(player);
  }

  private async upsertMapping(
    entityType: MappedEntityType,
    externalId: number | string,
    localId: string,
    metadata: Record<string, unknown>,
  ) {
    const existing = await this.findExistingMapping(entityType, externalId);
    const mapping =
      existing ??
      this.mappingRepo.create({
        provider: ExternalProvider.ApiFootball,
        entity_type: entityType,
        external_id: String(externalId),
      });

    mapping.local_id = localId;
    mapping.metadata = {
      ...metadata,
      reconciledAt: new Date().toISOString(),
    };

    await this.mappingRepo.save(mapping);
  }
}

function scorePlayerCandidate(
  player: Player,
  candidate: ApiFootballPlayerCandidate,
  context?: PlayerReconciliationContext,
): PlayerMatchCandidate | null {
  const aliasScores = normalizedAliases(candidate)
    .map((alias) => scorePlayerAlias(player, alias, candidate, context))
    .filter((item): item is PlayerMatchCandidate => item !== null)
    .sort((a, b) => b.score - a.score);

  return aliasScores[0] ?? null;
}

function scorePlayerAlias(
  player: Player,
  apiName: string,
  candidate: ApiFootballPlayerCandidate,
  context?: PlayerReconciliationContext,
): PlayerMatchCandidate | null {
  const localFullName = fullPlayerName(player);
  const normalizedApiName = normalizeName(apiName);
  const normalizedLocalFullName = normalizeName(localFullName);
  const compactApiName = compactName(apiName);
  const compactLocalFullName = compactName(localFullName);
  const localAbbreviation = initialsAndLastname(player.name, player.lastname);
  const localLastname = normalizeName(player.lastname);

  if (!normalizedApiName || !normalizedLocalFullName) return null;

  if (normalizedApiName === normalizedLocalFullName) {
    return { player, score: 100, strategy: "exact_full_name", matchedAlias: apiName };
  }

  if (compactApiName === compactLocalFullName) {
    return { player, score: 98, strategy: "compact_full_name", matchedAlias: apiName };
  }

  if (localAbbreviation && normalizedApiName === localAbbreviation) {
    const score = isAmbiguousAbbreviatedApiName(candidate, context) ? 70 : 95;
    return { player, score, strategy: "initial_and_lastname", matchedAlias: apiName };
  }

  const apiTokens = normalizedApiName.split(" ").filter(Boolean);
  const firstApiToken = apiTokens[0];
  const lastApiToken = apiTokens[apiTokens.length - 1];
  const normalizedFirstName = normalizeName(player.name);

  if (
    firstApiToken &&
    lastApiToken &&
    firstApiToken.length === 1 &&
    normalizedFirstName.startsWith(firstApiToken) &&
    localLastname === lastApiToken
  ) {
    const score = isAmbiguousAbbreviatedApiName(candidate, context) ? 70 : 92;
    return {
      player,
      score,
      strategy: "api_initial_local_first_name_lastname",
      matchedAlias: apiName,
    };
  }

  if (
    localLastname &&
    lastApiToken === localLastname &&
    normalizedApiName.includes(normalizedFirstName)
  ) {
    return {
      player,
      score: 88,
      strategy: "contains_first_name_and_lastname",
      matchedAlias: apiName,
    };
  }

  if (localLastname && normalizedApiName.endsWith(` ${localLastname}`)) {
    return { player, score: 65, strategy: "lastname_only", matchedAlias: apiName };
  }

  return null;
}

function createdPlayerMetadata(
  candidate: ApiFootballPlayerCandidate,
  player: Player | null,
  context: PlayerReconciliationContext | undefined,
  playerMatch: PlayerMatchCandidate | null,
): {
  status: "created";
  confidence: MappingConfidence;
  strategy: string;
  apiName: string;
  aliases: string[];
  localName: string;
  apiTeamId: number | null;
  localTeamId: string | null;
  season: number | null;
  bestCandidate: Record<string, unknown> | null;
} {
  const aliases = normalizedAliases(candidate);
  const confidence = createdPlayerConfidence(candidate, context);
  const oneNamePlayer = isTrustedOneNamePlayer(chooseBestCandidateName(candidate), context);

  return {
    status: "created",
    confidence,
    strategy: createdPlayerStrategy(confidence, oneNamePlayer),
    apiName: chooseBestCandidateName(candidate),
    aliases,
    localName: player ? fullPlayerName(player) : chooseBestCandidateName(candidate),
    apiTeamId: candidate.apiTeamId,
    localTeamId: context?.localTeamId ?? null,
    season: context?.season ?? null,
    bestCandidate: playerMatch
      ? {
          localId: playerMatch.player.player_id,
          localName: fullPlayerName(playerMatch.player),
          score: playerMatch.score,
          strategy: playerMatch.strategy,
          matchedAlias: playerMatch.matchedAlias,
        }
      : null,
  };
}

function createdPlayerConfidence(
  candidate: ApiFootballPlayerCandidate,
  context?: PlayerReconciliationContext,
): MappingConfidence {
  if (isTrustedOneNamePlayer(chooseBestCandidateName(candidate), context)) {
    return "high";
  }
  if (hasFullPersonName(candidate)) return "high";
  if (isAmbiguousAbbreviatedApiName(candidate, context)) return "low";
  if (isOneWordName(chooseBestCandidateName(candidate))) return "low";
  return "medium";
}

function createdPlayerStrategy(
  confidence: MappingConfidence,
  oneNamePlayer: boolean,
): string {
  if (oneNamePlayer) return "created_from_api_one_name_player";
  if (confidence === "low") return "created_from_api_player_needs_review";
  return "created_from_api_player_identity";
}

function playerNameParts(
  candidate: ApiFootballPlayerCandidate,
  context?: PlayerReconciliationContext,
): { name: string | null; lastname: string | null } {
  const bestName = chooseBestCandidateName(candidate);
  if (isTrustedOneNamePlayer(bestName, context)) {
    return { name: bestName, lastname: null };
  }

  return splitPersonName(bestName);
}

function isTrustedOneNamePlayer(
  value: string | null | undefined,
  context?: PlayerReconciliationContext,
): boolean {
  if (!context?.localTeamId || !ONE_NAME_PLAYER_TEAM_IDS.has(context.localTeamId)) {
    return false;
  }

  const tokens = normalizeName(value).split(" ").filter(Boolean);
  return isOneWordName(value) && (tokens[0]?.length ?? 0) > 1;
}

function isOneWordName(value: string | null | undefined): boolean {
  return normalizeName(value).split(" ").filter(Boolean).length === 1;
}

function isAmbiguousAbbreviatedApiName(
  candidate: ApiFootballPlayerCandidate,
  context?: PlayerReconciliationContext,
): boolean {
  if (!isAbbreviatedPersonName(chooseBestCandidateName(candidate))) return false;

  const candidateLastname = lastNameToken(chooseBestCandidateName(candidate));
  if (!candidateLastname) return false;

  const sameTeamPlayers = context?.sameTeamPlayers ?? [];
  return sameTeamPlayers.some((other) => {
    if (other.id === candidate.id) return false;
    return lastNameToken(chooseBestCandidateName(other)) === candidateLastname;
  });
}

function hasFullPersonName(candidate: ApiFootballPlayerCandidate): boolean {
  return normalizedAliases(candidate).some((alias) => {
    const tokens = normalizeName(alias).split(" ").filter(Boolean);
    return tokens.length >= 2 && (tokens[0]?.length ?? 0) > 1;
  });
}

function isAbbreviatedPersonName(value: string): boolean {
  const tokens = normalizeName(value).split(" ").filter(Boolean);
  return tokens.length >= 2 && (tokens[0]?.length ?? 0) === 1;
}

function lastNameToken(value: string): string | null {
  const tokens = normalizeName(value).split(" ").filter(Boolean);
  return tokens[tokens.length - 1] ?? null;
}

function chooseBestCandidateName(candidate: ApiFootballPlayerCandidate): string {
  return normalizedAliases(candidate).sort(
    (a, b) => apiPlayerNameQuality(b) - apiPlayerNameQuality(a),
  )[0] ?? candidate.name;
}

function apiPlayerNameQuality(value: string): number {
  const tokens = normalizeName(value).split(" ").filter(Boolean);
  const firstToken = tokens[0] ?? "";
  const hasFullFirstName = firstToken.length > 1;

  return tokens.length * 10 + (hasFullFirstName ? 10 : 0) + value.length / 100;
}

function normalizedAliases(candidate: ApiFootballPlayerCandidate): string[] {
  const aliases = [candidate.name, ...(candidate.aliases ?? [])]
    .map((alias) => alias.trim())
    .filter(Boolean);

  return [...new Set(aliases)];
}

function applyPositionFlags(player: Player, position: string | null) {
  const normalizedPosition = normalizeName(position);
  if (normalizedPosition === "g" || normalizedPosition === "goalkeeper") {
    player.goal_keeper = true;
  }
  if (normalizedPosition === "d" || normalizedPosition === "defender") {
    player.defender = true;
  }
  if (normalizedPosition === "m" || normalizedPosition === "midfielder") {
    player.midfielder = true;
  }
  if (normalizedPosition === "f" || normalizedPosition === "forward") {
    player.forward = true;
  }
}

function fullPlayerName(player: Player): string {
  return `${player.name ?? ""} ${player.lastname ?? ""}`.trim();
}

function parseConfidence(value: unknown): MappingConfidence {
  if (value === "exact" || value === "high" || value === "medium" || value === "low") {
    return value;
  }
  return "high";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
