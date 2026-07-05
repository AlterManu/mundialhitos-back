import { DataSource, Repository } from "typeorm";
import {
  GoalScoredEvent,
  isGoalScoredEvent,
  LiveEvent,
} from "@/domain/live/LiveEvent";
import {
  GoalStatisticsSnapshot,
  StatisticsUpdateResult,
} from "@/domain/statistics/StatisticsSnapshot";
import { ApiFootballFixture } from "@/entities/ApiFootballFixture";
import { LiveEventKind } from "@/entities/LiveEventLog";
import { PlayerAppearance } from "@/entities/PlayerAppearance";
import { PlayerOpponentStats } from "@/entities/PlayerOpponentStats";
import { PlayerStats } from "@/entities/PlayerStats";
import { TeamOpponentStats } from "@/entities/TeamOpponentStats";
import { TeamStats } from "@/entities/TeamStats";

export class StatisticsProjectionUpdater {
  private readonly playerStatsRepo: Repository<PlayerStats>;
  private readonly playerAppearanceRepo: Repository<PlayerAppearance>;
  private readonly fixtureRepo: Repository<ApiFootballFixture>;
  private readonly playerOpponentStatsRepo: Repository<PlayerOpponentStats>;
  private readonly teamStatsRepo: Repository<TeamStats>;
  private readonly teamOpponentStatsRepo: Repository<TeamOpponentStats>;

  constructor(dataSource: DataSource) {
    this.playerStatsRepo = dataSource.getRepository(PlayerStats);
    this.playerAppearanceRepo = dataSource.getRepository(PlayerAppearance);
    this.fixtureRepo = dataSource.getRepository(ApiFootballFixture);
    this.playerOpponentStatsRepo = dataSource.getRepository(PlayerOpponentStats);
    this.teamStatsRepo = dataSource.getRepository(TeamStats);
    this.teamOpponentStatsRepo = dataSource.getRepository(TeamOpponentStats);
  }

  async apply(event: LiveEvent): Promise<StatisticsUpdateResult> {
    if (
      event.kind === LiveEventKind.LineupConfirmed ||
      event.kind === LiveEventKind.SubstitutionMade
    ) {
      return { appearance: await this.applyAppearance(event) };
    }

    if (!isGoalScoredEvent(event)) return {};

    return {
      goal: await this.applyGoal(event),
    };
  }

  private async applyAppearance(event: LiveEvent) {
    const enteringPlayerId =
      event.kind === LiveEventKind.SubstitutionMade
        ? event.assistPlayerId
        : event.playerId;
    const fixture = await this.fixtureRepo.findOneBy({
      internal_match_id: event.matchId,
    });

    if (!enteringPlayerId || !event.teamId) {
      return {
        enteringPlayerId,
        previousAppearances: 0,
        previousTournamentAppearances: 0,
      };
    }

    const previousAppearances = await this.playerAppearanceRepo.countBy({
      player_id: enteringPlayerId,
    });
    const tournamentId = String(fixture?.season ?? "");
    const previousTournamentAppearances = tournamentId
      ? await this.playerAppearanceRepo.countBy({
          player_id: enteringPlayerId,
          tournament_id: tournamentId,
        })
      : 0;

    const existing = await this.playerAppearanceRepo.findOneBy({
      match_id: event.matchId,
      team_id: event.teamId,
      player_id: enteringPlayerId,
    });
    const payloadPlayer = readPayloadPlayer(event.payload);
    const appearance =
      existing ??
      this.playerAppearanceRepo.create({
        tournament_id: tournamentId || String(fixture?.league_id ?? "api-football"),
        match_id: event.matchId,
        team_id: event.teamId,
        player_id: enteringPlayerId,
      });

    appearance.starter = appearance.starter || event.kind === LiveEventKind.LineupConfirmed;
    appearance.substitute =
      appearance.substitute || event.kind === LiveEventKind.SubstitutionMade;
    appearance.shirt_number = appearance.shirt_number ?? payloadPlayer.number;
    appearance.position_code = appearance.position_code ?? payloadPlayer.positionCode;
    appearance.position_name = appearance.position_name ?? positionName(payloadPlayer.positionCode);

    await this.playerAppearanceRepo.save(appearance);

    return {
      enteringPlayerId,
      previousAppearances,
      previousTournamentAppearances,
    };
  }

  private async applyGoal(event: GoalScoredEvent) {
    const playerBefore = await this.playerStatsRepo.findOneBy({
      player_id: event.playerId,
    });
    const playerBeforeSnapshot = this.clone(playerBefore);
    const playerAfter =
      playerBefore ??
      this.playerStatsRepo.create({
        player_id: event.playerId,
      });

    if (event.ownGoal) {
      playerAfter.own_goals += 1;
    } else {
      playerAfter.world_cup_goals += 1;
      if (event.penalty) playerAfter.penalties_scored += 1;
    }

    const playerVsOpponentBefore =
      await this.playerOpponentStatsRepo.findOneBy({
        player_id: event.playerId,
        opponent_team_id: event.opponentId,
      });
    const playerVsOpponentBeforeSnapshot = this.clone(playerVsOpponentBefore);
    const playerVsOpponentAfter =
      playerVsOpponentBefore ??
      this.playerOpponentStatsRepo.create({
        player_id: event.playerId,
        opponent_team_id: event.opponentId,
      });

    if (!event.ownGoal) {
      playerVsOpponentAfter.goals += 1;
      if (event.penalty) playerVsOpponentAfter.penalties_scored += 1;
    }

    const teamBefore = await this.teamStatsRepo.findOneBy({
      team_id: event.teamId,
    });
    const teamBeforeSnapshot = this.clone(teamBefore);
    const teamAfter =
      teamBefore ??
      this.teamStatsRepo.create({
        team_id: event.teamId,
      });
    teamAfter.goals_for += 1;

    const teamVsOpponentBefore = await this.teamOpponentStatsRepo.findOneBy({
      team_id: event.teamId,
      opponent_team_id: event.opponentId,
    });
    const teamVsOpponentBeforeSnapshot = this.clone(teamVsOpponentBefore);
    const teamVsOpponentAfter =
      teamVsOpponentBefore ??
      this.teamOpponentStatsRepo.create({
        team_id: event.teamId,
        opponent_team_id: event.opponentId,
      });
    teamVsOpponentAfter.goals_for += 1;

    await this.playerStatsRepo.save(playerAfter);
    await this.playerOpponentStatsRepo.save(playerVsOpponentAfter);
    await this.teamStatsRepo.save(teamAfter);
    await this.teamOpponentStatsRepo.save(teamVsOpponentAfter);

    return {
      playerBefore: playerBeforeSnapshot,
      playerAfter: this.cloneRequired(playerAfter),
      playerVsOpponentBefore: playerVsOpponentBeforeSnapshot,
      playerVsOpponentAfter: this.cloneRequired(playerVsOpponentAfter),
      teamBefore: teamBeforeSnapshot,
      teamAfter: this.cloneRequired(teamAfter),
      teamVsOpponentBefore: teamVsOpponentBeforeSnapshot,
      teamVsOpponentAfter: this.cloneRequired(teamVsOpponentAfter),
    } satisfies GoalStatisticsSnapshot;
  }

  private clone<T extends object>(value: T | null): T | null {
    return value ? ({ ...value } as T) : null;
  }

  private cloneRequired<T extends object>(value: T): T {
    return { ...value } as T;
  }
}

function readPayloadPlayer(payload: Record<string, unknown>) {
  const player =
    typeof payload.player === "object" && payload.player !== null
      ? (payload.player as Record<string, unknown>)
      : {};
  return {
    number: typeof player.number === "number" ? player.number : null,
    positionCode: typeof player.pos === "string" ? player.pos : null,
  };
}

function positionName(positionCode: string | null) {
  switch ((positionCode ?? "").toUpperCase()) {
    case "G":
    case "GK":
      return "Goalkeeper";
    case "D":
      return "Defender";
    case "M":
      return "Midfielder";
    case "F":
      return "Forward";
    default:
      return null;
  }
}
