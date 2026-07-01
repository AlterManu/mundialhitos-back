import { LiveEvent } from "@/domain/live/LiveEvent";
import { LiveEventKind } from "@/entities/LiveEventLog";
import { MappedEntityType } from "@/entities/ExternalIdMapping";
import { ApiFootballFixtureDto, ApiFootballFixtureEventDto } from "./ApiFootballTypes";
import { ExternalIdMappingResolver } from "./ExternalIdMappingResolver";

const API_FOOTBALL_PROVIDER = "api-football";

export class ApiFootballLiveEventMapper {
  constructor(private readonly idResolver: ExternalIdMappingResolver) {}

  async toLiveEvents(fixture: ApiFootballFixtureDto): Promise<LiveEvent[]> {
    const matchId = await this.idResolver.resolve(
      MappedEntityType.Match,
      fixture.fixture.id,
    );
    if (!matchId) return [];

    const homeTeamId = await this.idResolver.resolve(
      MappedEntityType.Team,
      fixture.teams.home.id,
    );
    const awayTeamId = await this.idResolver.resolve(
      MappedEntityType.Team,
      fixture.teams.away.id,
    );

    if (!homeTeamId || !awayTeamId) return [];

    const events = fixture.events ?? [];
    const normalized: LiveEvent[] = [];

    for (const [index, event] of events.entries()) {
      const mapped = await this.mapEvent(
        fixture,
        event,
        index,
        matchId,
        homeTeamId,
        awayTeamId,
      );
      if (mapped) normalized.push(mapped);
    }

    return normalized;
  }

  private async mapEvent(
    fixture: ApiFootballFixtureDto,
    event: ApiFootballFixtureEventDto,
    index: number,
    matchId: string,
    homeTeamId: string,
    awayTeamId: string,
  ): Promise<LiveEvent | null> {
    const teamId = await this.idResolver.resolve(
      MappedEntityType.Team,
      event.team.id,
    );
    const playerId = await this.idResolver.resolve(
      MappedEntityType.Player,
      event.player.id,
    );
    const assistPlayerId = await this.idResolver.resolve(
      MappedEntityType.Player,
      event.assist.id,
    );
    const opponentId =
      teamId === homeTeamId ? awayTeamId : teamId === awayTeamId ? homeTeamId : null;

    const kind = this.mapKind(event.type);
    if (!kind) return null;

    return {
      identity: {
        provider: API_FOOTBALL_PROVIDER,
        providerEventId: this.buildProviderEventId(fixture.fixture.id, event, index),
        sequenceNumber: index,
      },
      kind,
      matchId,
      teamId,
      opponentId,
      playerId,
      assistPlayerId,
      minute: event.time.elapsed,
      additionalMinute: event.time.extra,
      occurredAt: fixture.fixture.date,
      detail: event.detail,
      payload: event as unknown as Record<string, unknown>,
      ownGoal: event.detail?.toLowerCase().includes("own goal") ?? false,
      penalty: event.detail?.toLowerCase().includes("penalty") ?? false,
    } as LiveEvent;
  }

  private mapKind(type: string): LiveEventKind | null {
    if (type === "Goal") return LiveEventKind.GoalScored;
    if (type === "Card") return LiveEventKind.CardShown;
    if (type === "subst") return LiveEventKind.SubstitutionMade;
    if (type === "Var") return LiveEventKind.VarDecision;
    return null;
  }

  private buildProviderEventId(
    fixtureId: number,
    event: ApiFootballFixtureEventDto,
    index: number,
  ): string {
    const minute = event.time.elapsed ?? "unknown";
    const extra = event.time.extra ?? 0;
    const player = event.player.id ?? event.player.name ?? "unknown";
    return `${fixtureId}:${index}:${event.type}:${event.detail ?? "none"}:${minute}+${extra}:${player}`;
  }
}
