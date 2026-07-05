import { DataSource, Repository } from "typeorm";
import { InsightCandidate } from "@/domain/insights/InsightCandidate";
import { InsightImportance } from "@/domain/insights/InsightImportance";
import { ApiFootballFixture } from "@/entities/ApiFootballFixture";
import { Insight, InsightPhase, InsightScope } from "@/entities/Insight";
import { Match } from "@/entities/Match";
import { PlayerAppearance } from "@/entities/PlayerAppearance";
import { TeamOpponentStats } from "@/entities/TeamOpponentStats";
import { TeamTournamentStat } from "@/entities/TeamTournamentStat";
import { TeamWorldCupTitle } from "@/entities/TeamWorldCupTitle";
import { InsightPersistenceService } from "./InsightPersistenceService";

export class MatchInsightGenerationService {
  private readonly fixtureRepo: Repository<ApiFootballFixture>;
  private readonly matchRepo: Repository<Match>;
  private readonly playerAppearanceRepo: Repository<PlayerAppearance>;
  private readonly teamOpponentStatsRepo: Repository<TeamOpponentStats>;
  private readonly teamTournamentStatsRepo: Repository<TeamTournamentStat>;
  private readonly teamWorldCupTitleRepo: Repository<TeamWorldCupTitle>;
  private readonly insightPersistence: InsightPersistenceService;

  constructor(dataSource: DataSource) {
    this.fixtureRepo = dataSource.getRepository(ApiFootballFixture);
    this.matchRepo = dataSource.getRepository(Match);
    this.playerAppearanceRepo = dataSource.getRepository(PlayerAppearance);
    this.teamOpponentStatsRepo = dataSource.getRepository(TeamOpponentStats);
    this.teamTournamentStatsRepo = dataSource.getRepository(TeamTournamentStat);
    this.teamWorldCupTitleRepo = dataSource.getRepository(TeamWorldCupTitle);
    this.insightPersistence = new InsightPersistenceService(dataSource);
  }

  async generatePreMatch(internalMatchId: string): Promise<Insight[]> {
    const fixture = await this.getFixture(internalMatchId);
    const candidates: InsightCandidate[] = [];

    if (!fixture.home_local_team_id || !fixture.away_local_team_id) {
      return [];
    }

    const headToHead = await this.teamOpponentStatsRepo.findOneBy({
      team_id: fixture.home_local_team_id,
      opponent_team_id: fixture.away_local_team_id,
    });

    if (!headToHead || headToHead.matches === 0) {
      candidates.push({
        type: "pre-never-met",
        phase: InsightPhase.PreMatch,
        scope: InsightScope.HeadToHead,
        subjectId: `${fixture.home_local_team_id}:${fixture.away_local_team_id}`,
        matchId: fixture.internal_match_id,
        dedupeKey: `pre-never-met:${fixture.internal_match_id}`,
        importanceScore: InsightImportance.High,
        title: "Primer enfrentamiento mundialista",
        body: `${fixture.home_team_name} y ${fixture.away_team_name} nunca se enfrentaron en una Copa del Mundo.`,
        facts: {
          homeTeamId: fixture.home_local_team_id,
          awayTeamId: fixture.away_local_team_id,
        },
      });
    } else {
      candidates.push({
        type: "pre-head-to-head-summary",
        phase: InsightPhase.PreMatch,
        scope: InsightScope.HeadToHead,
        subjectId: `${fixture.home_local_team_id}:${fixture.away_local_team_id}`,
        matchId: fixture.internal_match_id,
        dedupeKey: `pre-head-to-head-summary:${fixture.internal_match_id}`,
        importanceScore: InsightImportance.Medium,
        title: "Historial mundialista entre ambos",
        body: `${fixture.home_team_name} y ${fixture.away_team_name} ya se enfrentaron ${headToHead.matches} vez/veces en Mundiales.`,
        facts: {
          matches: headToHead.matches,
          homeWins: headToHead.wins,
          draws: headToHead.draws,
          homeLosses: headToHead.losses,
        },
      });
    }

    const sameStageMeetings = await this.findHistoricalMeetings(
      fixture.home_local_team_id,
      fixture.away_local_team_id,
      { stageName: fixture.round },
    );
    if (fixture.round && sameStageMeetings.length === 0) {
      candidates.push({
        type: "pre-first-stage-meeting",
        phase: InsightPhase.PreMatch,
        scope: InsightScope.HeadToHead,
        subjectId: `${fixture.home_local_team_id}:${fixture.away_local_team_id}`,
        matchId: fixture.internal_match_id,
        dedupeKey: `pre-first-stage-meeting:${fixture.internal_match_id}`,
        importanceScore: InsightImportance.Medium,
        title: "Cruce inédito en esta instancia",
        body: `${fixture.home_team_name} y ${fixture.away_team_name} nunca se enfrentaron en ${fixture.round} en Mundiales.`,
        facts: {
          stage: fixture.round,
          homeTeamId: fixture.home_local_team_id,
          awayTeamId: fixture.away_local_team_id,
        },
      });
    }

    if (isKnockoutStage(fixture.round)) {
      const knockoutMeetings = await this.findHistoricalMeetings(
        fixture.home_local_team_id,
        fixture.away_local_team_id,
        { knockoutOnly: true },
      );
      const homeKnockoutWins = knockoutMeetings.filter(
        (match) => match.winner === fixture.home_local_team_id,
      );
      if (homeKnockoutWins.length === 0) {
        candidates.push({
          type: "pre-never-beat-opponent-in-knockout",
          phase: InsightPhase.PreMatch,
          scope: InsightScope.HeadToHead,
          subjectId: `${fixture.home_local_team_id}:${fixture.away_local_team_id}`,
          matchId: fixture.internal_match_id,
          dedupeKey: `pre-never-beat-opponent-in-knockout:${fixture.internal_match_id}:${fixture.home_local_team_id}`,
          importanceScore: InsightImportance.High,
          title: "Cuenta pendiente en eliminatorias",
          body: `${fixture.home_team_name} nunca derrotó a ${fixture.away_team_name} en eliminatorias mundialistas.`,
          facts: {
            teamId: fixture.home_local_team_id,
            opponentId: fixture.away_local_team_id,
            previousKnockoutMeetings: knockoutMeetings.length,
          },
        });
      }
    }

    return this.insightPersistence.saveCandidates(candidates, null);
  }

  async generatePostMatch(internalMatchId: string): Promise<Insight[]> {
    const fixture = await this.getFixture(internalMatchId);
    const candidates: InsightCandidate[] = [];

    if (!fixture.home_local_team_id || !fixture.away_local_team_id) {
      return [];
    }

    const winner = this.getWinner(fixture);
    if (!winner) {
      candidates.push(
        ...(await this.generateCleanSheetInsights(fixture)),
        ...(await this.generateGoalkeeperCleanSheetInsights(fixture)),
        ...(await this.generateScorelessTournamentInsights(fixture)),
        ...(await this.generateGroupEliminationInsights(fixture)),
        ...(await this.generateConcededThresholdPostInsights(fixture)),
        ...(await this.generateExtraTimePenaltyHeadToHeadInsights(fixture)),
      );
      return this.insightPersistence.saveCandidates(candidates, null);
    }

    const loser =
      winner.localTeamId === fixture.home_local_team_id
        ? {
            localTeamId: fixture.away_local_team_id,
            name: fixture.away_team_name,
          }
        : {
            localTeamId: fixture.home_local_team_id,
            name: fixture.home_team_name,
          };

    const previousHeadToHead = await this.teamOpponentStatsRepo.findOneBy({
      team_id: winner.localTeamId,
      opponent_team_id: loser.localTeamId,
    });

    if (!previousHeadToHead || previousHeadToHead.wins === 0) {
      candidates.push({
        type: "post-first-win-vs-opponent",
        phase: InsightPhase.PostMatch,
        scope: InsightScope.HeadToHead,
        subjectId: `${winner.localTeamId}:${loser.localTeamId}`,
        matchId: fixture.internal_match_id,
        dedupeKey: `post-first-win-vs-opponent:${fixture.internal_match_id}:${winner.localTeamId}`,
        importanceScore: InsightImportance.High,
        title: "Primera victoria mundialista ante este rival",
        body: `${winner.name} consiguió su primera victoria mundialista ante ${loser.name}.`,
        facts: {
          winnerTeamId: winner.localTeamId,
          loserTeamId: loser.localTeamId,
        },
      });
    } else {
      const previousWin = await this.findMostRecentWinBeforeFixture(
        winner.localTeamId,
        loser.localTeamId,
        fixture.season,
      );

      if (previousWin) {
        const yearsSince = fixture.season - previousWin.world_cup_year;
        candidates.push({
          type: "post-first-win-since",
          phase: InsightPhase.PostMatch,
          scope: InsightScope.HeadToHead,
          subjectId: `${winner.localTeamId}:${loser.localTeamId}`,
          matchId: fixture.internal_match_id,
          dedupeKey: `post-first-win-since:${fixture.internal_match_id}:${winner.localTeamId}`,
          importanceScore:
            yearsSince >= 20 ? InsightImportance.High : InsightImportance.Medium,
          title: "Victoria con peso histórico",
          body: `${winner.name} no vencía a ${loser.name} en Mundiales desde ${previousWin.world_cup_year}.`,
          facts: {
            previousWinMatchId: previousWin.match_id,
            previousWinYear: previousWin.world_cup_year,
            yearsSince,
          },
        });
      }
    }

    candidates.push(
      ...(await this.generateChampionWinInsights(fixture, winner.localTeamId, loser.localTeamId, winner.name, loser.name)),
      ...(await this.generateCleanSheetInsights(fixture)),
      ...(await this.generateGoalkeeperCleanSheetInsights(fixture)),
      ...(await this.generateScorelessTournamentInsights(fixture)),
      ...(await this.generateGroupEliminationInsights(fixture)),
      ...(await this.generateConcededThresholdPostInsights(fixture)),
      ...(await this.generateExtraTimePenaltyHeadToHeadInsights(fixture)),
    );

    return this.insightPersistence.saveCandidates(candidates, null);
  }

  private async getFixture(internalMatchId: string) {
    const fixture = await this.fixtureRepo.findOneBy({ internal_match_id: internalMatchId });
    if (!fixture) {
      throw new Error(`Fixture ${internalMatchId} not found`);
    }
    return fixture;
  }

  private getWinner(fixture: ApiFootballFixture) {
    if (!isFinishedStatus(fixture.status_short)) return null;
    if (!fixture.home_local_team_id || !fixture.away_local_team_id) return null;

    if (fixture.home_winner === true) {
      return {
        localTeamId: fixture.home_local_team_id,
        name: fixture.home_team_name,
      };
    }

    if (fixture.away_winner === true) {
      return {
        localTeamId: fixture.away_local_team_id,
        name: fixture.away_team_name,
      };
    }

    if (fixture.home_goals === null || fixture.away_goals === null) return null;
    if (fixture.home_goals === fixture.away_goals) return null;

    return fixture.home_goals > fixture.away_goals
      ? {
          localTeamId: fixture.home_local_team_id,
          name: fixture.home_team_name,
        }
      : {
          localTeamId: fixture.away_local_team_id,
          name: fixture.away_team_name,
        };
  }

  private async findMostRecentWinBeforeFixture(
    winnerTeamId: string,
    loserTeamId: string,
    fixtureSeason: number,
  ) {
    return this.matchRepo
      .createQueryBuilder("match")
      .where("match.world_cup_year < :fixtureSeason", { fixtureSeason })
      .andWhere("match.winner = :winnerTeamId", { winnerTeamId })
      .andWhere(
        "((match.home_team_id = :winnerTeamId AND match.away_team_id = :loserTeamId) OR (match.home_team_id = :loserTeamId AND match.away_team_id = :winnerTeamId))",
        { winnerTeamId, loserTeamId },
      )
      .orderBy("match.world_cup_year", "DESC")
      .getOne();
  }

  private async findHistoricalMeetings(
    teamA: string,
    teamB: string,
    options?: { stageName?: string | null; knockoutOnly?: boolean },
  ) {
    const query = this.matchRepo
      .createQueryBuilder("match")
      .where(
        "((match.home_team_id = :teamA AND match.away_team_id = :teamB) OR (match.home_team_id = :teamB AND match.away_team_id = :teamA))",
        { teamA, teamB },
      );

    if (options?.stageName) {
      query.andWhere("LOWER(match.stage_name) = LOWER(:stageName)", {
        stageName: options.stageName,
      });
    }

    const matches = await query.getMany();
    return options?.knockoutOnly
      ? matches.filter((match) => isKnockoutStage(match.stage_name))
      : matches;
  }

  private async generateChampionWinInsights(
    fixture: ApiFootballFixture,
    winnerTeamId: string,
    loserTeamId: string,
    winnerName: string,
    loserName: string,
  ): Promise<InsightCandidate[]> {
    const loserTitles = await this.teamWorldCupTitleRepo.findOneBy({
      team_id: loserTeamId,
    });
    if (!loserTitles || loserTitles.titles === 0) return [];

    const previousWinVsChampion = await this.matchRepo
      .createQueryBuilder("match")
      .innerJoin(TeamWorldCupTitle, "titles", "titles.team_id = CASE WHEN match.home_team_id = :winnerTeamId THEN match.away_team_id ELSE match.home_team_id END")
      .where("match.world_cup_year < :season", { season: fixture.season })
      .andWhere("match.winner = :winnerTeamId", { winnerTeamId })
      .andWhere(
        "(match.home_team_id = :winnerTeamId OR match.away_team_id = :winnerTeamId)",
        { winnerTeamId },
      )
      .getOne();

    if (previousWinVsChampion) return [];

    return [
      {
        type: "post-first-win-vs-world-champion",
        phase: InsightPhase.PostMatch,
        scope: InsightScope.Team,
        subjectId: winnerTeamId,
        matchId: fixture.internal_match_id,
        dedupeKey: `post-first-win-vs-world-champion:${fixture.internal_match_id}:${winnerTeamId}`,
        importanceScore: InsightImportance.High,
        title: "Victoria ante un campeón del mundo",
        body: `${winnerName} derrotó por primera vez en Mundiales a una selección campeona del mundo: ${loserName}.`,
        facts: {
          winnerTeamId,
          loserTeamId,
          loserTitles: loserTitles.titles,
          loserTitleYears: loserTitles.years,
        },
      },
    ];
  }

  private async generateCleanSheetInsights(
    fixture: ApiFootballFixture,
  ): Promise<InsightCandidate[]> {
    const candidates: InsightCandidate[] = [];
    for (const team of teamsFromFixture(fixture)) {
      if (team.goalsAgainst !== 0) continue;
      const previousCleanSheetStreak = await this.cleanSheetStreakBefore(
        team.localTeamId,
        fixture.season,
      );
      const streak = previousCleanSheetStreak + 1;
      if (streak < 3) continue;
      candidates.push({
        type: "post-team-clean-sheet-streak",
        phase: InsightPhase.PostMatch,
        scope: InsightScope.Team,
        subjectId: team.localTeamId,
        matchId: fixture.internal_match_id,
        dedupeKey: `post-team-clean-sheet-streak:${fixture.internal_match_id}:${team.localTeamId}:${streak}`,
        importanceScore: streak >= 5 ? InsightImportance.Historic : InsightImportance.High,
        title: "Racha sin recibir goles",
        body: `${team.name} acumula ${streak} partidos mundialistas consecutivos sin recibir goles.`,
        facts: { teamId: team.localTeamId, streak },
      });
    }
    return candidates;
  }

  private async generateGoalkeeperCleanSheetInsights(
    fixture: ApiFootballFixture,
  ): Promise<InsightCandidate[]> {
    const candidates: InsightCandidate[] = [];
    for (const team of teamsFromFixture(fixture)) {
      if (team.goalsAgainst !== 0) continue;
      const goalkeeper = await this.findMatchGoalkeeper(
        fixture.internal_match_id,
        team.localTeamId,
      );
      if (!goalkeeper) continue;

      const previousStreak = await this.goalkeeperCleanSheetStreakBefore(
        goalkeeper.player_id,
        fixture.kickoff_at,
      );
      const streak = previousStreak + 1;
      if (streak < 2) continue;

      candidates.push({
        type: "post-goalkeeper-clean-sheet-streak",
        phase: InsightPhase.PostMatch,
        scope: InsightScope.Player,
        subjectId: goalkeeper.player_id,
        matchId: fixture.internal_match_id,
        dedupeKey: `post-goalkeeper-clean-sheet-streak:${fixture.internal_match_id}:${goalkeeper.player_id}:${streak}`,
        importanceScore: streak >= 4 ? InsightImportance.High : InsightImportance.Medium,
        title: "Arquero en racha sin recibir goles",
        body: `El arquero ${goalkeeper.player_id} acumula ${streak} partidos mundialistas consecutivos sin recibir goles.`,
        facts: {
          goalkeeperId: goalkeeper.player_id,
          teamId: team.localTeamId,
          streak,
        },
      });
    }
    return candidates;
  }

  private async generateScorelessTournamentInsights(
    fixture: ApiFootballFixture,
  ): Promise<InsightCandidate[]> {
    const candidates: InsightCandidate[] = [];
    for (const team of teamsFromFixture(fixture)) {
      const tournamentGoals = await this.goalsForInApiTournament(
        fixture.season,
        team.localTeamId,
      );
      if (tournamentGoals !== 0) continue;
      candidates.push({
        type: "post-team-scoreless-tournament",
        phase: InsightPhase.PostMatch,
        scope: InsightScope.Team,
        subjectId: team.localTeamId,
        matchId: fixture.internal_match_id,
        dedupeKey: `post-team-scoreless-tournament:${fixture.season}:${team.localTeamId}`,
        importanceScore: InsightImportance.High,
        title: "Sin goles en el Mundial",
        body: `${team.name} todavía no marcó goles en este Mundial.`,
        facts: { teamId: team.localTeamId, season: fixture.season },
      });
    }
    return candidates;
  }

  private async generateGroupEliminationInsights(
    fixture: ApiFootballFixture,
  ): Promise<InsightCandidate[]> {
    if (!isGroupStage(fixture.round)) return [];
    const candidates: InsightCandidate[] = [];

    for (const team of teamsFromFixture(fixture)) {
      if (!(await this.isGroupStageCompleteForTeam(fixture.season, team.localTeamId))) {
        continue;
      }
      if (await this.hasApiKnockoutFixture(fixture.season, team.localTeamId)) {
        continue;
      }

      const previousTournaments = await this.teamTournamentStatsRepo.find({
        where: { team_id: team.localTeamId },
      });
      const previousGroupExits = previousTournaments.filter(
        (stat) => !stat.reached_knockout,
      );

      if (previousTournaments.length === 0) {
        candidates.push({
          type: "post-first-world-cup-group-exit",
          phase: InsightPhase.PostMatch,
          scope: InsightScope.Team,
          subjectId: team.localTeamId,
          matchId: fixture.internal_match_id,
          dedupeKey: `post-first-world-cup-group-exit:${fixture.season}:${team.localTeamId}`,
          importanceScore: InsightImportance.Medium,
          title: "Debut mundialista sin eliminatorias",
          body: `${team.name} disputa su primer Mundial y no logra clasificar a eliminatorias.`,
          facts: { teamId: team.localTeamId, season: fixture.season },
        });
      } else if (previousGroupExits.length === 0) {
        candidates.push({
          type: "post-first-group-stage-elimination",
          phase: InsightPhase.PostMatch,
          scope: InsightScope.Team,
          subjectId: team.localTeamId,
          matchId: fixture.internal_match_id,
          dedupeKey: `post-first-group-stage-elimination:${fixture.season}:${team.localTeamId}`,
          importanceScore: InsightImportance.Historic,
          title: "Primera vez fuera en fase de grupos",
          body: `Es la primera vez que ${team.name} no clasifica a eliminatorias en una Copa del Mundo.`,
          facts: {
            teamId: team.localTeamId,
            season: fixture.season,
            previousTournaments: previousTournaments.length,
          },
        });
      }
    }

    return candidates;
  }

  private async generateConcededThresholdPostInsights(
    fixture: ApiFootballFixture,
  ): Promise<InsightCandidate[]> {
    const candidates: InsightCandidate[] = [];
    for (const team of teamsFromFixture(fixture)) {
      for (const threshold of [3, 4, 5]) {
        if (team.goalsAgainst < threshold) continue;
        const previous = await this.matchRepo
          .createQueryBuilder("match")
          .where("match.world_cup_year < :season", { season: fixture.season })
          .andWhere(
            "((match.home_team_id = :teamId AND match.away_score >= :threshold) OR (match.away_team_id = :teamId AND match.home_score >= :threshold))",
            { teamId: team.localTeamId, threshold },
          )
          .getOne();
        if (previous) continue;
        candidates.push({
          type: `post-first-time-conceded-${threshold}`,
          phase: InsightPhase.PostMatch,
          scope: InsightScope.Team,
          subjectId: team.localTeamId,
          matchId: fixture.internal_match_id,
          dedupeKey: `post-first-time-conceded-${threshold}:${fixture.internal_match_id}:${team.localTeamId}`,
          importanceScore:
            threshold >= 5 ? InsightImportance.Historic : InsightImportance.High,
          title: `Primera vez recibiendo ${threshold}+ goles`,
          body: `Es la primera vez que ${team.name} recibe ${threshold} o más goles en un partido mundialista.`,
          facts: { teamId: team.localTeamId, threshold },
        });
      }
    }
    return candidates;
  }

  private async generateExtraTimePenaltyHeadToHeadInsights(
    fixture: ApiFootballFixture,
  ): Promise<InsightCandidate[]> {
    if (!fixture.home_local_team_id || !fixture.away_local_team_id) return [];
    const meetings = await this.findHistoricalMeetings(
      fixture.home_local_team_id,
      fixture.away_local_team_id,
    );
    const candidates: InsightCandidate[] = [];
    if (["AET", "PEN"].includes(fixture.status_short)) {
      if (!meetings.some((match) => match.extra_time)) {
        candidates.push({
          type: "post-first-extra-time-head-to-head",
          phase: InsightPhase.PostMatch,
          scope: InsightScope.HeadToHead,
          subjectId: `${fixture.home_local_team_id}:${fixture.away_local_team_id}`,
          matchId: fixture.internal_match_id,
          dedupeKey: `post-first-extra-time-head-to-head:${fixture.internal_match_id}`,
          importanceScore: InsightImportance.Medium,
          title: "Primera prórroga entre ambos",
          body: `${fixture.home_team_name} y ${fixture.away_team_name} nunca habían jugado una prórroga entre sí en Mundiales.`,
          facts: {},
        });
      }
    }
    if (fixture.status_short === "PEN" && !meetings.some((match) => match.penalties)) {
      candidates.push({
        type: "post-first-penalty-shootout-head-to-head",
        phase: InsightPhase.PostMatch,
        scope: InsightScope.HeadToHead,
        subjectId: `${fixture.home_local_team_id}:${fixture.away_local_team_id}`,
        matchId: fixture.internal_match_id,
        dedupeKey: `post-first-penalty-shootout-head-to-head:${fixture.internal_match_id}`,
        importanceScore: InsightImportance.High,
        title: "Primera tanda entre ambos",
        body: `${fixture.home_team_name} y ${fixture.away_team_name} nunca habían definido por penales entre sí en Mundiales.`,
        facts: {},
      });
    }
    return candidates;
  }

  private async cleanSheetStreakBefore(teamId: string, season: number) {
    const matches = await this.matchRepo
      .createQueryBuilder("match")
      .where("match.world_cup_year < :season", { season })
      .andWhere("(match.home_team_id = :teamId OR match.away_team_id = :teamId)", {
        teamId,
      })
      .orderBy("match.world_cup_year", "DESC")
      .addOrderBy("match.date", "DESC")
      .getMany();
    let streak = 0;
    for (const match of matches) {
      const goalsAgainst =
        match.home_team_id === teamId ? match.away_score : match.home_score;
      if (goalsAgainst === 0) streak += 1;
      else break;
    }
    return streak;
  }

  private async goalsForInApiTournament(season: number, teamId: string) {
    const fixtures = await this.fixtureRepo.find({ where: { season } });
    return fixtures.reduce((sum, fixture) => {
      if (fixture.home_local_team_id === teamId) return sum + (fixture.home_goals ?? 0);
      if (fixture.away_local_team_id === teamId) return sum + (fixture.away_goals ?? 0);
      return sum;
    }, 0);
  }

  private async findMatchGoalkeeper(matchId: string, teamId: string) {
    const appearances = await this.playerAppearanceRepo.find({
      where: { match_id: matchId, team_id: teamId },
    });
    return appearances.find(isGoalkeeperAppearance) ?? null;
  }

  private async goalkeeperCleanSheetStreakBefore(
    goalkeeperId: string,
    currentKickoffAt: string,
  ) {
    const appearances = await this.playerAppearanceRepo.find({
      where: { player_id: goalkeeperId },
    });
    const playedMatches = [];

    for (const appearance of appearances) {
      const historicalMatch = await this.matchRepo.findOneBy({
        match_id: appearance.match_id,
      });
      if (historicalMatch) {
        playedMatches.push({
          date: historicalMatch.date,
          goalsAgainst:
            appearance.team_id === historicalMatch.home_team_id
              ? historicalMatch.away_score
              : historicalMatch.home_score,
        });
        continue;
      }

      const apiFixture = await this.fixtureRepo.findOneBy({
        internal_match_id: appearance.match_id,
      });
      if (!apiFixture) continue;
      const team = teamsFromFixture(apiFixture).find(
        (item) => item.localTeamId === appearance.team_id,
      );
      if (!team) continue;
      playedMatches.push({
        date: apiFixture.kickoff_at,
        goalsAgainst: team.goalsAgainst,
      });
    }

    playedMatches.sort((a, b) => b.date.localeCompare(a.date));
    let streak = 0;
    for (const match of playedMatches) {
      if (match.date >= currentKickoffAt) continue;
      if (match.goalsAgainst === 0) streak += 1;
      else break;
    }
    return streak;
  }

  private async isGroupStageCompleteForTeam(season: number, teamId: string) {
    const fixtures = await this.fixtureRepo.find({ where: { season } });
    const groupFixtures = fixtures.filter(
      (fixture) =>
        isGroupStage(fixture.round) &&
        (fixture.home_local_team_id === teamId || fixture.away_local_team_id === teamId),
    );
    return (
      groupFixtures.length > 0 &&
      groupFixtures.every((fixture) => isFinishedStatus(fixture.status_short))
    );
  }

  private async hasApiKnockoutFixture(season: number, teamId: string) {
    const fixtures = await this.fixtureRepo.find({ where: { season } });
    return fixtures.some(
      (fixture) =>
        !isGroupStage(fixture.round) &&
        (fixture.home_local_team_id === teamId || fixture.away_local_team_id === teamId),
    );
  }
}

function isFinishedStatus(status: string): boolean {
  return ["FT", "AET", "PEN"].includes(status);
}

function isKnockoutStage(stageName: string | null): boolean {
  return !!stageName && !stageName.toLowerCase().includes("group");
}

function isGroupStage(stageName: string | null): boolean {
  return !!stageName && stageName.toLowerCase().includes("group");
}

function isGoalkeeperAppearance(appearance: PlayerAppearance): boolean {
  const code = (appearance.position_code ?? "").toLowerCase();
  const name = (appearance.position_name ?? "").toLowerCase();
  return code === "g" || code === "gk" || name.includes("goalkeeper");
}

function teamsFromFixture(fixture: ApiFootballFixture) {
  if (!fixture.home_local_team_id || !fixture.away_local_team_id) return [];
  return [
    {
      localTeamId: fixture.home_local_team_id,
      name: fixture.home_team_name,
      goalsFor: fixture.home_goals ?? 0,
      goalsAgainst: fixture.away_goals ?? 0,
    },
    {
      localTeamId: fixture.away_local_team_id,
      name: fixture.away_team_name,
      goalsFor: fixture.away_goals ?? 0,
      goalsAgainst: fixture.home_goals ?? 0,
    },
  ];
}
