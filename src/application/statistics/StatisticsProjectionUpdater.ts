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
import { PlayerOpponentStats } from "@/entities/PlayerOpponentStats";
import { PlayerStats } from "@/entities/PlayerStats";
import { TeamOpponentStats } from "@/entities/TeamOpponentStats";
import { TeamStats } from "@/entities/TeamStats";

export class StatisticsProjectionUpdater {
  private readonly playerStatsRepo: Repository<PlayerStats>;
  private readonly playerOpponentStatsRepo: Repository<PlayerOpponentStats>;
  private readonly teamStatsRepo: Repository<TeamStats>;
  private readonly teamOpponentStatsRepo: Repository<TeamOpponentStats>;

  constructor(dataSource: DataSource) {
    this.playerStatsRepo = dataSource.getRepository(PlayerStats);
    this.playerOpponentStatsRepo = dataSource.getRepository(PlayerOpponentStats);
    this.teamStatsRepo = dataSource.getRepository(TeamStats);
    this.teamOpponentStatsRepo = dataSource.getRepository(TeamOpponentStats);
  }

  async apply(event: LiveEvent): Promise<StatisticsUpdateResult> {
    if (!isGoalScoredEvent(event)) return {};

    return {
      goal: await this.applyGoal(event),
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
