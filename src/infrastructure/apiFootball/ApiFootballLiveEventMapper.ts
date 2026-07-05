import { LiveEvent } from "@/domain/live/LiveEvent";
import { LiveEventKind } from "@/entities/LiveEventLog";
import { MappedEntityType } from "@/entities/ExternalIdMapping";
import {
  ApiFootballFixtureDto,
  ApiFootballFixtureEventDto,
  ApiFootballLineupDto,
  ApiFootballLineupPlayerDto,
} from "./ApiFootballTypes";
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

    const normalized: LiveEvent[] = [];

    normalized.push(
      ...(await this.mapStartingLineups(fixture, matchId, homeTeamId, awayTeamId)),
    );

    const events = fixture.events ?? [];
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

  private async mapStartingLineups(
    fixture: ApiFootballFixtureDto,
    matchId: string,
    homeTeamId: string,
    awayTeamId: string,
  ): Promise<LiveEvent[]> {
    const events: LiveEvent[] = [];
    const lineups = fixture.lineups ?? [];

    for (const lineup of lineups) {
      const teamId = await this.idResolver.resolve(
        MappedEntityType.Team,
        lineup.team.id,
      );
      if (!teamId) continue;
      const opponentId =
        teamId === homeTeamId ? awayTeamId : teamId === awayTeamId ? homeTeamId : null;

      for (const [playerIndex, player] of (lineup.startXI ?? []).entries()) {
        const mapped = await this.mapLineupPlayer(
          fixture,
          lineup,
          player,
          playerIndex,
          matchId,
          teamId,
          opponentId,
        );
        if (mapped) events.push(mapped);
      }
    }

    return events;
  }

  private async mapLineupPlayer(
    fixture: ApiFootballFixtureDto,
    lineup: ApiFootballLineupDto,
    lineupPlayer: ApiFootballLineupPlayerDto,
    playerIndex: number,
    matchId: string,
    teamId: string,
    opponentId: string | null,
  ): Promise<LiveEvent | null> {
    const playerId = await this.idResolver.resolve(
      MappedEntityType.Player,
      lineupPlayer.player.id,
    );
    if (!playerId) return null;

    return {
      identity: {
        provider: API_FOOTBALL_PROVIDER,
        providerEventId: `${fixture.fixture.id}:lineup:start:${lineup.team.id}:${lineupPlayer.player.id ?? playerIndex}`,
        sequenceNumber: -1000 + playerIndex,
      },
      kind: LiveEventKind.LineupConfirmed,
      matchId,
      teamId,
      opponentId,
      playerId,
      assistPlayerId: null,
      minute: 0,
      additionalMinute: null,
      occurredAt: fixture.fixture.date,
      detail: "Starting XI",
      payload: {
        type: "Lineup",
        detail: "Starting XI",
        team: lineup.team,
        player: lineupPlayer.player,
        formation: lineup.formation ?? null,
        starter: true,
      },
    };
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

    const kind = this.mapKind(event);
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

  private mapKind(event: ApiFootballFixtureEventDto): LiveEventKind | null {
    if (event.comments === "Penalty Shootout") {
      return LiveEventKind.PenaltyShootoutKick;
    }

    if (event.type === "Goal") {
      if (event.detail === "Missed Penalty") return LiveEventKind.PenaltyMissed;
      return LiveEventKind.GoalScored;
    }
    if (event.type === "Card") return LiveEventKind.CardShown;
    if (event.type === "subst") return LiveEventKind.SubstitutionMade;
    if (event.type === "Var") return LiveEventKind.VarDecision;
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
