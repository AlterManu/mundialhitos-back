import { DataSource, Repository } from "typeorm";
import { LiveEventKind } from "@/entities/LiveEventLog";
import {
  GoalScoredEvent,
  isGoalScoredEvent,
  LiveEvent,
} from "@/domain/live/LiveEvent";
import {
  InsightEventContext,
  StatisticsUpdateResult,
} from "@/domain/statistics/StatisticsSnapshot";
import { ApiFootballFixture } from "@/entities/ApiFootballFixture";
import { Goal } from "@/entities/Goal";
import { GoalkeeperTournamentStat } from "@/entities/GoalkeeperTournamentStat";
import { LiveEventLog, LiveEventProcessingStatus } from "@/entities/LiveEventLog";
import { Match } from "@/entities/Match";
import { PenaltyKick } from "@/entities/PenaltyKick";
import { Player } from "@/entities/Player";
import { PlayerMatchGoalStat } from "@/entities/PlayerMatchGoalStat";
import {
  PlayerStatMetric,
  PlayerStatRanking,
  PlayerStatRankingScope,
} from "@/entities/PlayerStatRanking";
import { PlayerStats } from "@/entities/PlayerStats";
import { PlayerAppearance } from "@/entities/PlayerAppearance";
import { Team } from "@/entities/Team";
import { TeamWorldCupTitle } from "@/entities/TeamWorldCupTitle";

export class InsightContextBuilder {
  private readonly fixtureRepo: Repository<ApiFootballFixture>;
  private readonly eventRepo: Repository<LiveEventLog>;
  private readonly goalRepo: Repository<Goal>;
  private readonly matchRepo: Repository<Match>;
  private readonly penaltyRepo: Repository<PenaltyKick>;
  private readonly playerAppearanceRepo: Repository<PlayerAppearance>;
  private readonly playerStatsRepo: Repository<PlayerStats>;
  private readonly playerRepo: Repository<Player>;
  private readonly teamRepo: Repository<Team>;
  private readonly teamWorldCupTitleRepo: Repository<TeamWorldCupTitle>;
  private readonly goalkeeperTournamentStatRepo: Repository<GoalkeeperTournamentStat>;
  private readonly rankingRepo: Repository<PlayerStatRanking>;
  private readonly playerMatchGoalStatRepo: Repository<PlayerMatchGoalStat>;

  constructor(dataSource: DataSource) {
    this.fixtureRepo = dataSource.getRepository(ApiFootballFixture);
    this.eventRepo = dataSource.getRepository(LiveEventLog);
    this.goalRepo = dataSource.getRepository(Goal);
    this.matchRepo = dataSource.getRepository(Match);
    this.penaltyRepo = dataSource.getRepository(PenaltyKick);
    this.playerAppearanceRepo = dataSource.getRepository(PlayerAppearance);
    this.playerStatsRepo = dataSource.getRepository(PlayerStats);
    this.playerRepo = dataSource.getRepository(Player);
    this.teamRepo = dataSource.getRepository(Team);
    this.teamWorldCupTitleRepo = dataSource.getRepository(TeamWorldCupTitle);
    this.goalkeeperTournamentStatRepo =
      dataSource.getRepository(GoalkeeperTournamentStat);
    this.rankingRepo = dataSource.getRepository(PlayerStatRanking);
    this.playerMatchGoalStatRepo = dataSource.getRepository(PlayerMatchGoalStat);
  }

  async build(
    event: LiveEvent,
    statistics: StatisticsUpdateResult,
  ): Promise<InsightEventContext> {
    if (isGoalScoredEvent(event)) {
      return { goal: await this.buildGoalContext(event, statistics) };
    }

    if (event.kind === LiveEventKind.CardShown) {
      return { card: await this.buildCardContext(event) };
    }

    if (
      event.kind === LiveEventKind.SubstitutionMade ||
      event.kind === LiveEventKind.LineupConfirmed
    ) {
      if (statistics.appearance) {
        return { substitution: statistics.appearance };
      }
      return { substitution: await this.buildSubstitutionContext(event) };
    }

    return {};
  }

  private async buildGoalContext(
    event: GoalScoredEvent,
    statistics: StatisticsUpdateResult,
  ) {
    const fixture = await this.fixtureRepo.findOneBy({
      internal_match_id: event.matchId,
    });
    const season = fixture?.season ?? null;
    const playerGoalsBefore = await this.countLiveGoals({
      matchId: event.matchId,
      playerId: event.playerId,
      beforeSequence: event.identity.sequenceNumber,
      includeOwnGoals: false,
    });
    const teamGoalsBefore = await this.countLiveGoals({
      matchId: event.matchId,
      teamId: event.teamId,
      beforeSequence: event.identity.sequenceNumber,
      includeOwnGoals: true,
    });
    const opponentGoalsAgainstBefore = await this.countLiveGoals({
      matchId: event.matchId,
      teamId: event.teamId,
      beforeSequence: event.identity.sequenceNumber,
      includeOwnGoals: true,
    });
    const goalAddsToPlayer = event.ownGoal ? 0 : 1;
    const goalAddsToTeam = 1;
    const playerGoalsAfter = playerGoalsBefore + goalAddsToPlayer;
    const teamGoalsAfter = teamGoalsBefore + goalAddsToTeam;
    const playerGoalStats = await this.playerMatchGoalStatRepo.find({
      where: { player_id: event.playerId },
    });
    const playerVsOpponentGoalStats = playerGoalStats.filter(
      (item) => item.opponent_team_id === event.opponentId,
    );
    const previousMultiGoalMatches = playerGoalStats.filter(
      (item) => item.goals === 2,
    );
    const previousHatTricks = playerGoalStats.filter((item) => item.goals >= 3);
    const previousMultiGoalVsOpponent = playerVsOpponentGoalStats.filter(
      (item) => item.goals === 2,
    );
    const previousHatTricksVsOpponent = playerVsOpponentGoalStats.filter(
      (item) => item.goals >= 3,
    );
    const lastAnyPlayerMultiGoalAgainstOpponent =
      await this.findLastAnyPlayerMultiGoalAgainstTeam(event.opponentId, 2);
    const lastAnyPlayerHatTrickAgainstOpponent =
      await this.findLastAnyPlayerMultiGoalAgainstTeam(event.opponentId, 3);
    const penaltyMissesBefore = await this.penaltyRepo.countBy({
      player_id: event.playerId,
      converted: false,
    });
    const ownGoalsBefore = await this.goalRepo.countBy({
      scored_by_player: event.playerId,
      own_goal: true,
    });
    const ownGoalsAfter = ownGoalsBefore + (event.ownGoal ? 1 : 0);
    const playerBeforeGoals =
      statistics.goal?.playerBefore?.world_cup_goals ??
      (await this.playerStatsRepo.findOneBy({ player_id: event.playerId }))
        ?.world_cup_goals ??
      0;
    const playerAfterGoals =
      statistics.goal?.playerAfter.world_cup_goals ?? playerBeforeGoals;
    const playerPenaltyGoalsBefore =
      statistics.goal?.playerBefore?.penalties_scored ?? 0;
    const playerPenaltyGoalsAfter =
      statistics.goal?.playerAfter.penalties_scored ?? playerPenaltyGoalsBefore;
    const assistTotals = event.assistPlayerId
      ? await this.assistTotalsAfter(event.assistPlayerId)
      : null;
    const tournamentGoalsBefore = season
      ? await this.playerTournamentGoalsBefore(event.playerId, season, event)
      : 0;
    const tournamentGoalsAfter = tournamentGoalsBefore + goalAddsToPlayer;
    const concedingGoalkeeper = season
      ? await this.findGoalkeeperForTeam(event.matchId, event.opponentId)
      : null;
    const goalkeeperGoalsConcededBefore =
      season && concedingGoalkeeper
        ? await this.goalkeeperGoalsConcededBefore(
            concedingGoalkeeper.player_id,
            concedingGoalkeeper.team_id,
            season,
            event,
          )
        : 0;
    const goalkeeperGoalsConcededAfter =
      goalkeeperGoalsConcededBefore + (concedingGoalkeeper ? 1 : 0);
    const tournamentTotalGoalsBefore = season
      ? await this.tournamentTotalGoalsBefore(season, event)
      : 0;

    return {
      playerName: await this.playerName(event.playerId),
      teamName: await this.teamName(event.teamId),
      opponentName: await this.teamName(event.opponentId),
      assistPlayerName: event.assistPlayerId
        ? await this.playerName(event.assistPlayerId)
        : null,
      currentMatchPlayerGoalsBefore: playerGoalsBefore,
      currentMatchPlayerGoalsAfter: playerGoalsAfter,
      currentMatchTeamGoalsForBefore: teamGoalsBefore,
      currentMatchTeamGoalsForAfter: teamGoalsAfter,
      currentMatchOpponentGoalsAgainstBefore: opponentGoalsAgainstBefore,
      currentMatchOpponentGoalsAgainstAfter:
        opponentGoalsAgainstBefore + goalAddsToTeam,
      previousPlayerMultiGoalMatches: previousMultiGoalMatches.length,
      previousPlayerHatTricks: previousHatTricks.length,
      previousPlayerMultiGoalMatchesVsOpponent:
        previousMultiGoalVsOpponent.length,
      previousPlayerHatTricksVsOpponent: previousHatTricksVsOpponent.length,
      lastPlayerMultiGoalMatchYear: latestYear(previousMultiGoalMatches),
      lastPlayerMultiGoalMatchVsOpponentYear: latestYear(
        previousMultiGoalVsOpponent,
      ),
      lastPlayerHatTrickVsOpponentYear: latestYear(previousHatTricksVsOpponent),
      lastAnyPlayerMultiGoalAgainstOpponentYear:
        lastAnyPlayerMultiGoalAgainstOpponent?.world_cup_year ?? null,
      lastAnyPlayerHatTrickAgainstOpponentYear:
        lastAnyPlayerHatTrickAgainstOpponent?.world_cup_year ?? null,
      allTimeGoalRankBefore: await this.rankForGoalTotal(
        PlayerStatRankingScope.AllTime,
        null,
        null,
        playerBeforeGoals,
      ),
      allTimeGoalRankAfter: await this.rankForGoalTotal(
        PlayerStatRankingScope.AllTime,
        null,
        null,
        playerAfterGoals,
      ),
      nationalGoalRankBefore: await this.rankForGoalTotal(
        PlayerStatRankingScope.NationalAllTime,
        null,
        event.teamId,
        playerBeforeGoals,
      ),
      nationalGoalRankAfter: await this.rankForGoalTotal(
        PlayerStatRankingScope.NationalAllTime,
        null,
        event.teamId,
        playerAfterGoals,
      ),
      tournamentGoalRankBefore: season
        ? await this.rankForGoalTotal(
            PlayerStatRankingScope.Tournament,
            season,
            null,
            tournamentGoalsBefore,
          )
        : null,
      tournamentGoalRankAfter: season
        ? await this.rankForGoalTotal(
            PlayerStatRankingScope.Tournament,
            season,
            null,
            tournamentGoalsAfter,
          )
        : null,
      tournamentTotalGoalsBefore,
      tournamentTotalGoalsAfter: tournamentTotalGoalsBefore + goalAddsToPlayer,
      penaltyGoalsBefore: playerPenaltyGoalsBefore,
      penaltyGoalsAfter: playerPenaltyGoalsAfter,
      allTimePenaltyGoalRankBefore: await this.rankForStatTotal(
        PlayerStatMetric.PenaltiesScored,
        PlayerStatRankingScope.AllTime,
        null,
        null,
        playerPenaltyGoalsBefore,
      ),
      allTimePenaltyGoalRankAfter: await this.rankForStatTotal(
        PlayerStatMetric.PenaltiesScored,
        PlayerStatRankingScope.AllTime,
        null,
        null,
        playerPenaltyGoalsAfter,
      ),
      nationalPenaltyGoalRankBefore: await this.rankForStatTotal(
        PlayerStatMetric.PenaltiesScored,
        PlayerStatRankingScope.NationalAllTime,
        null,
        event.teamId,
        playerPenaltyGoalsBefore,
      ),
      nationalPenaltyGoalRankAfter: await this.rankForStatTotal(
        PlayerStatMetric.PenaltiesScored,
        PlayerStatRankingScope.NationalAllTime,
        null,
        event.teamId,
        playerPenaltyGoalsAfter,
      ),
      penaltyMissesBefore,
      assistAllTimeRankBefore:
        event.assistPlayerId && assistTotals
          ? await this.rankForStatTotal(
              PlayerStatMetric.Assists,
              PlayerStatRankingScope.AllTime,
              null,
              null,
              assistTotals.before,
            )
          : null,
      assistAllTimeRankAfter:
        event.assistPlayerId && assistTotals
          ? await this.rankForStatTotal(
              PlayerStatMetric.Assists,
              PlayerStatRankingScope.AllTime,
              null,
              null,
              assistTotals.after,
            )
          : null,
      assistNationalRankBefore:
        event.assistPlayerId && assistTotals
          ? await this.rankForStatTotal(
              PlayerStatMetric.Assists,
              PlayerStatRankingScope.NationalAllTime,
              null,
              event.teamId,
              assistTotals.before,
            )
          : null,
      assistNationalRankAfter:
        event.assistPlayerId && assistTotals
          ? await this.rankForStatTotal(
              PlayerStatMetric.Assists,
              PlayerStatRankingScope.NationalAllTime,
              null,
              event.teamId,
              assistTotals.after,
            )
          : null,
      assistTotalBefore: assistTotals?.before ?? null,
      assistTotalAfter: assistTotals?.after ?? null,
      ownGoalsBefore,
      ownGoalsAfter,
      ownGoalRankAfter: await this.ownGoalRankForTotal(ownGoalsAfter),
      scoringStreakBefore: await this.scoringStreakBefore(event),
      scoringStreakAfter:
        (await this.scoringStreakBefore(event)) + (goalAddsToPlayer ? 1 : 0),
      concedingGoalkeeperId: concedingGoalkeeper?.player_id ?? null,
      concedingGoalkeeperName: concedingGoalkeeper
        ? await this.playerName(concedingGoalkeeper.player_id)
        : null,
      goalkeeperTournamentGoalsConcededBefore: goalkeeperGoalsConcededBefore,
      goalkeeperTournamentGoalsConcededAfter: goalkeeperGoalsConcededAfter,
      goalkeeperTournamentGoalsConcededRankAfter:
        season && concedingGoalkeeper
          ? await this.goalkeeperConcededRankAfter(
              season,
              goalkeeperGoalsConcededAfter,
              concedingGoalkeeper.player_id,
            )
          : null,
    };
  }

  private async buildSubstitutionContext(event: LiveEvent) {
    const enteringPlayerId =
      event.kind === LiveEventKind.SubstitutionMade
        ? event.assistPlayerId
        : event.playerId;
    const fixture = await this.fixtureRepo.findOneBy({
      internal_match_id: event.matchId,
    });

    if (!enteringPlayerId) {
      return {
        enteringPlayerId: null,
        enteringPlayerName: null,
        teamName: event.teamId ? await this.teamName(event.teamId) : null,
        teamHasWorldCupTitle: false,
        previousAppearances: 0,
        previousTournamentAppearances: 0,
      };
    }
    const teamHasWorldCupTitle = event.teamId
      ? !!(await this.teamWorldCupTitleRepo.findOneBy({ team_id: event.teamId }))
      : false;

    return {
      enteringPlayerId,
      enteringPlayerName: await this.playerName(enteringPlayerId),
      teamName: event.teamId ? await this.teamName(event.teamId) : null,
      teamHasWorldCupTitle,
      previousAppearances: await this.playerAppearanceRepo.countBy({
        player_id: enteringPlayerId,
      }),
      previousTournamentAppearances: fixture
        ? await this.playerAppearanceRepo.countBy({
            player_id: enteringPlayerId,
            tournament_id: String(fixture.season),
          })
        : 0,
    };
  }

  private async buildCardContext(event: LiveEvent) {
    const playerName = event.playerId ? await this.playerName(event.playerId) : "";
    const teamName = event.teamId ? await this.teamName(event.teamId) : null;
    const playerStats = event.playerId
      ? await this.playerStatsRepo.findOneBy({ player_id: event.playerId })
      : null;
    const detail = (event.detail ?? "").toLowerCase();
    const secondYellow = detail.includes("second yellow");
    const rankings = [];

    if (event.playerId && detail.includes("yellow")) {
      const totalAfter = playerStats?.yellow_cards ?? 0;
      const totalBefore = Math.max(totalAfter - 1, 0);
      rankings.push({
        metric: PlayerStatMetric.YellowCards,
        label: "tarjetas amarillas",
        totalBefore,
        totalAfter,
        allTimeRankBefore: await this.rankForStatTotal(
          PlayerStatMetric.YellowCards,
          PlayerStatRankingScope.AllTime,
          null,
          null,
          totalBefore,
        ),
        allTimeRankAfter: await this.rankForStatTotal(
          PlayerStatMetric.YellowCards,
          PlayerStatRankingScope.AllTime,
          null,
          null,
          totalAfter,
        ),
        nationalRankBefore: event.teamId
          ? await this.rankForStatTotal(
              PlayerStatMetric.YellowCards,
              PlayerStatRankingScope.NationalAllTime,
              null,
              event.teamId,
              totalBefore,
            )
          : null,
        nationalRankAfter: event.teamId
          ? await this.rankForStatTotal(
              PlayerStatMetric.YellowCards,
              PlayerStatRankingScope.NationalAllTime,
              null,
              event.teamId,
              totalAfter,
            )
          : null,
      });
    }

    if (event.playerId && (detail.includes("red") || secondYellow)) {
      const totalAfter = playerStats?.red_cards ?? 0;
      const totalBefore = Math.max(totalAfter - 1, 0);
      rankings.push({
        metric: PlayerStatMetric.RedCards,
        label: "tarjetas rojas",
        totalBefore,
        totalAfter,
        allTimeRankBefore: await this.rankForStatTotal(
          PlayerStatMetric.RedCards,
          PlayerStatRankingScope.AllTime,
          null,
          null,
          totalBefore,
        ),
        allTimeRankAfter: await this.rankForStatTotal(
          PlayerStatMetric.RedCards,
          PlayerStatRankingScope.AllTime,
          null,
          null,
          totalAfter,
        ),
        nationalRankBefore: event.teamId
          ? await this.rankForStatTotal(
              PlayerStatMetric.RedCards,
              PlayerStatRankingScope.NationalAllTime,
              null,
              event.teamId,
              totalBefore,
            )
          : null,
        nationalRankAfter: event.teamId
          ? await this.rankForStatTotal(
              PlayerStatMetric.RedCards,
              PlayerStatRankingScope.NationalAllTime,
              null,
              event.teamId,
              totalAfter,
            )
          : null,
      });
    }

    return {
      playerName,
      teamName,
      rankings: rankings.map((ranking) => ({
        ...ranking,
        metric: ranking.metric as "yellow_cards" | "red_cards",
      })),
    };
  }

  private async countLiveGoals(options: {
    matchId: string;
    playerId?: string;
    teamId?: string;
    beforeSequence: number;
    includeOwnGoals: boolean;
  }) {
    const query = this.eventRepo
      .createQueryBuilder("event")
      .where("event.match_id = :matchId", { matchId: options.matchId })
      .andWhere("event.kind = :kind", { kind: LiveEventKind.GoalScored })
      .andWhere("event.sequence_number < :sequence", {
        sequence: options.beforeSequence,
      })
      .andWhere("event.status != :failed", {
        failed: LiveEventProcessingStatus.Failed,
      });

    if (options.playerId) {
      query.andWhere("event.player_id = :playerId", {
        playerId: options.playerId,
      });
    }
    if (options.teamId) {
      query.andWhere("event.team_id = :teamId", { teamId: options.teamId });
    }

    const events = await query.getMany();
    return events.filter((event) => {
      if (options.includeOwnGoals) return true;
      return !isOwnGoalPayload(event.payload);
    }).length;
  }

  private async findLastAnyPlayerMultiGoalAgainstTeam(
    teamId: string,
    minimumGoals: 2 | 3,
  ) {
    const query = this.playerMatchGoalStatRepo
      .createQueryBuilder("stat")
      .where("stat.opponent_team_id = :teamId", { teamId })
      .orderBy("stat.world_cup_year", "DESC")
      .addOrderBy("stat.match_date", "DESC");

    if (minimumGoals === 2) {
      query.andWhere("stat.goals = 2");
    } else {
      query.andWhere("stat.goals >= 3");
    }

    return query.getOne();
  }

  private async rankForGoalTotal(
    scope: PlayerStatRankingScope,
    worldCupYear: number | null,
    teamId: string | null,
    goals: number,
  ) {
    return this.rankForStatTotal(
      PlayerStatMetric.Goals,
      scope,
      worldCupYear,
      teamId,
      goals,
    );
  }

  private async rankForStatTotal(
    metric: PlayerStatMetric,
    scope: PlayerStatRankingScope,
    worldCupYear: number | null,
    teamId: string | null,
    value: number,
  ) {
    if (value <= 0) return null;
    if (!(await this.hasRankingSet(metric, scope, worldCupYear, teamId))) {
      return null;
    }
    const query = this.rankingRepo
      .createQueryBuilder("ranking")
      .where("ranking.metric = :metric", { metric })
      .andWhere("ranking.scope = :scope", { scope })
      .andWhere("ranking.value > :value", { value });

    this.applyRankingScope(query, worldCupYear, teamId);

    return (await query.getCount()) + 1;
  }

  private async hasRankingSet(
    metric: PlayerStatMetric,
    scope: PlayerStatRankingScope,
    worldCupYear: number | null,
    teamId: string | null,
  ) {
    const query = this.rankingRepo
      .createQueryBuilder("ranking")
      .where("ranking.metric = :metric", { metric })
      .andWhere("ranking.scope = :scope", { scope });

    this.applyRankingScope(query, worldCupYear, teamId);

    return (await query.getCount()) > 0;
  }

  private applyRankingScope(
    query: ReturnType<Repository<PlayerStatRanking>["createQueryBuilder"]>,
    worldCupYear: number | null,
    teamId: string | null,
  ) {
    if (worldCupYear === null) {
      query.andWhere("ranking.world_cup_year IS NULL");
    } else {
      query.andWhere("ranking.world_cup_year = :worldCupYear", { worldCupYear });
    }

    if (teamId === null) {
      query.andWhere("ranking.team_id IS NULL");
    } else {
      query.andWhere("ranking.team_id = :teamId", { teamId });
    }
  }

  private async assistTotalsAfter(playerId: string) {
    const stats = await this.playerStatsRepo.findOneBy({ player_id: playerId });
    const after = stats?.assists ?? 0;
    return { before: Math.max(after - 1, 0), after };
  }

  private async ownGoalRankForTotal(ownGoals: number) {
    if (ownGoals <= 0) return null;
    const rows = await this.goalRepo
      .createQueryBuilder("goal")
      .select("goal.scored_by_player", "playerId")
      .addSelect("COUNT(1)", "ownGoals")
      .where("goal.own_goal = true")
      .groupBy("goal.scored_by_player")
      .getRawMany<{ playerId: string; ownGoals: string }>();
    return rows.filter((row) => Number(row.ownGoals) > ownGoals).length + 1;
  }

  private async playerTournamentGoalsBefore(
    playerId: string,
    season: number,
    event: GoalScoredEvent,
  ) {
    const historical = await this.playerMatchGoalStatRepo
      .createQueryBuilder("stat")
      .select("COALESCE(SUM(stat.goals), 0)", "goals")
      .where("stat.player_id = :playerId", { playerId })
      .andWhere("stat.world_cup_year = :season", { season })
      .getRawOne<{ goals: string }>();

    const liveBefore = await this.countLiveGoals({
      matchId: event.matchId,
      playerId,
      beforeSequence: event.identity.sequenceNumber,
      includeOwnGoals: false,
    });

    return Number(historical?.goals ?? 0) + liveBefore;
  }

  private async tournamentTotalGoalsBefore(season: number, event: GoalScoredEvent) {
    const historical = await this.goalRepo.countBy({
      world_cup_year: season,
      own_goal: false,
    });
    const liveBefore = await this.countLiveGoals({
      matchId: event.matchId,
      beforeSequence: event.identity.sequenceNumber,
      includeOwnGoals: false,
    });
    return historical + liveBefore;
  }

  private async findGoalkeeperForTeam(matchId: string, teamId: string) {
    const appearances = await this.playerAppearanceRepo.find({
      where: { match_id: matchId, team_id: teamId },
    });
    return (
      appearances.find((appearance) => isGoalkeeperAppearance(appearance)) ?? null
    );
  }

  private async goalkeeperGoalsConcededBefore(
    playerId: string,
    teamId: string,
    season: number,
    event: GoalScoredEvent,
  ) {
    const stored = await this.goalkeeperTournamentStatRepo.findOneBy({
      world_cup_year: season,
      player_id: playerId,
    });
    const liveBefore = await this.liveGoalsAgainstTeamBefore(teamId, season, event);
    return (stored?.goals_conceded ?? 0) + liveBefore;
  }

  private async liveGoalsAgainstTeamBefore(
    teamId: string,
    season: number,
    event: GoalScoredEvent,
  ) {
    const fixtures = await this.fixtureRepo.find({ where: { season } });
    const matchIds = new Set(fixtures.map((fixture) => fixture.internal_match_id));
    const events = await this.eventRepo.find({
      where: { kind: LiveEventKind.GoalScored },
    });
    return events.filter((log) => {
      if (!matchIds.has(log.match_id)) return false;
      if (log.opponent_id !== teamId) return false;
      if (log.status === LiveEventProcessingStatus.Failed) return false;
      if (log.match_id !== event.matchId) return true;
      return log.sequence_number < event.identity.sequenceNumber;
    }).length;
  }

  private async goalkeeperConcededRankAfter(
    season: number,
    currentTotal: number,
    currentGoalkeeperId: string,
  ) {
    const totals = new Map<string, number>();
    const stored = await this.goalkeeperTournamentStatRepo.find({
      where: { world_cup_year: season },
    });
    for (const stat of stored) {
      totals.set(stat.player_id, stat.goals_conceded);
    }

    const goalkeepers = await this.playerAppearanceRepo.find({
      where: { tournament_id: String(season) },
    });
    for (const appearance of goalkeepers.filter(isGoalkeeperAppearance)) {
      const conceded = await this.liveGoalsAgainstTeamBefore(
        appearance.team_id,
        season,
        {
          matchId: "__after_all__",
          identity: { sequenceNumber: Number.MAX_SAFE_INTEGER },
        } as GoalScoredEvent,
      );
      totals.set(
        appearance.player_id,
        Math.max(totals.get(appearance.player_id) ?? 0, conceded),
      );
    }

    totals.set(currentGoalkeeperId, currentTotal);
    return [...totals.values()].filter((total) => total > currentTotal).length + 1;
  }

  private async scoringStreakBefore(event: GoalScoredEvent) {
    const fixture = await this.fixtureRepo.findOneBy({
      internal_match_id: event.matchId,
    });
    if (!fixture) return 0;

    const matches = await this.matchRepo
      .createQueryBuilder("match")
      .where("match.world_cup_year < :season", { season: fixture.season })
      .orWhere(
        "match.world_cup_year = :season AND match.date < :date",
        { season: fixture.season, date: fixture.kickoff_at.slice(0, 10) },
      )
      .orderBy("match.world_cup_year", "DESC")
      .addOrderBy("match.date", "DESC")
      .getMany();

    let streak = 0;
    for (const match of matches) {
      const goals = await this.goalRepo.countBy({
        match_id: match.match_id,
        scored_by_player: event.playerId,
        own_goal: false,
      });
      if (goals > 0) streak += 1;
      else if (this.playerCouldHaveAppeared(match, event.teamId)) break;
    }
    return streak;
  }

  private playerCouldHaveAppeared(match: Match, teamId: string) {
    return match.home_team_id === teamId || match.away_team_id === teamId;
  }

  private async playerName(playerId: string) {
    const player = await this.playerRepo.findOneBy({ player_id: playerId });
    return fullPlayerName(player) || playerId;
  }

  private async teamName(teamId: string) {
    const team = await this.teamRepo.findOneBy({ team_id: teamId });
    return team?.name_en ?? teamId;
  }
}

function latestYear(items: PlayerMatchGoalStat[]) {
  return items.length
    ? Math.max(...items.map((item) => item.world_cup_year))
    : null;
}

function isOwnGoalPayload(payload: Record<string, unknown>) {
  const detail = payload.detail;
  return typeof detail === "string" && detail.toLowerCase().includes("own goal");
}

function isGoalkeeperAppearance(appearance: PlayerAppearance): boolean {
  const code = (appearance.position_code ?? "").toLowerCase();
  const name = (appearance.position_name ?? "").toLowerCase();
  return code === "g" || code === "gk" || name.includes("goalkeeper");
}

function fullPlayerName(player: Player | null) {
  if (!player) return null;
  return `${player.name ?? ""} ${player.lastname ?? ""}`.trim() || null;
}
