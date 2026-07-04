import { DataSource, Repository } from "typeorm";
import { InsightCandidate } from "@/domain/insights/InsightCandidate";
import { InsightImportance } from "@/domain/insights/InsightImportance";
import { ApiFootballFixture } from "@/entities/ApiFootballFixture";
import { Insight, InsightPhase, InsightScope } from "@/entities/Insight";
import { Match } from "@/entities/Match";
import { TeamOpponentStats } from "@/entities/TeamOpponentStats";
import { InsightPersistenceService } from "./InsightPersistenceService";

export class MatchInsightGenerationService {
  private readonly fixtureRepo: Repository<ApiFootballFixture>;
  private readonly matchRepo: Repository<Match>;
  private readonly teamOpponentStatsRepo: Repository<TeamOpponentStats>;
  private readonly insightPersistence: InsightPersistenceService;

  constructor(dataSource: DataSource) {
    this.fixtureRepo = dataSource.getRepository(ApiFootballFixture);
    this.matchRepo = dataSource.getRepository(Match);
    this.teamOpponentStatsRepo = dataSource.getRepository(TeamOpponentStats);
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

    return this.insightPersistence.saveCandidates(candidates, null);
  }

  async generatePostMatch(internalMatchId: string): Promise<Insight[]> {
    const fixture = await this.getFixture(internalMatchId);
    const candidates: InsightCandidate[] = [];

    if (!fixture.home_local_team_id || !fixture.away_local_team_id) {
      return [];
    }

    const winner = this.getWinner(fixture);
    if (!winner) return [];

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
}

function isFinishedStatus(status: string): boolean {
  return ["FT", "AET", "PEN"].includes(status);
}
