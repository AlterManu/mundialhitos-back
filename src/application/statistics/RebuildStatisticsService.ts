import { DataSource, Repository } from "typeorm";
import { Goal } from "@/entities/Goal";
import { GoalkeeperTournamentStat } from "@/entities/GoalkeeperTournamentStat";
import { Match } from "@/entities/Match";
import {
  PlayerGoalRanking,
  PlayerGoalRankingScope,
} from "@/entities/PlayerGoalRanking";
import { PlayerMatchGoalStat } from "@/entities/PlayerMatchGoalStat";
import { PlayerOpponentStats } from "@/entities/PlayerOpponentStats";
import { PlayerAppearance } from "@/entities/PlayerAppearance";
import { PlayerStats } from "@/entities/PlayerStats";
import { TeamOpponentStats } from "@/entities/TeamOpponentStats";
import { TeamStats } from "@/entities/TeamStats";
import { TeamTournamentStat } from "@/entities/TeamTournamentStat";
import { TeamWorldCupTitle } from "@/entities/TeamWorldCupTitle";

export interface RebuildStatisticsResult {
  matchesProcessed: number;
  goalsProcessed: number;
  playerStats: number;
  playerOpponentStats: number;
  teamStats: number;
  teamOpponentStats: number;
  playerMatchGoalStats: number;
  playerGoalRankings: number;
  teamTournamentStats: number;
  teamWorldCupTitles: number;
  goalkeeperTournamentStats: number;
}

export class RebuildStatisticsService {
  private readonly matchRepo: Repository<Match>;
  private readonly goalRepo: Repository<Goal>;
  private readonly playerStatsRepo: Repository<PlayerStats>;
  private readonly playerAppearanceRepo: Repository<PlayerAppearance>;
  private readonly playerOpponentStatsRepo: Repository<PlayerOpponentStats>;
  private readonly teamStatsRepo: Repository<TeamStats>;
  private readonly teamOpponentStatsRepo: Repository<TeamOpponentStats>;
  private readonly playerMatchGoalStatRepo: Repository<PlayerMatchGoalStat>;
  private readonly playerGoalRankingRepo: Repository<PlayerGoalRanking>;
  private readonly teamTournamentStatRepo: Repository<TeamTournamentStat>;
  private readonly teamWorldCupTitleRepo: Repository<TeamWorldCupTitle>;
  private readonly goalkeeperTournamentStatRepo: Repository<GoalkeeperTournamentStat>;

  constructor(private readonly dataSource: DataSource) {
    this.matchRepo = dataSource.getRepository(Match);
    this.goalRepo = dataSource.getRepository(Goal);
    this.playerStatsRepo = dataSource.getRepository(PlayerStats);
    this.playerAppearanceRepo = dataSource.getRepository(PlayerAppearance);
    this.playerOpponentStatsRepo = dataSource.getRepository(PlayerOpponentStats);
    this.teamStatsRepo = dataSource.getRepository(TeamStats);
    this.teamOpponentStatsRepo = dataSource.getRepository(TeamOpponentStats);
    this.playerMatchGoalStatRepo = dataSource.getRepository(PlayerMatchGoalStat);
    this.playerGoalRankingRepo = dataSource.getRepository(PlayerGoalRanking);
    this.teamTournamentStatRepo = dataSource.getRepository(TeamTournamentStat);
    this.teamWorldCupTitleRepo = dataSource.getRepository(TeamWorldCupTitle);
    this.goalkeeperTournamentStatRepo =
      dataSource.getRepository(GoalkeeperTournamentStat);
  }

  async rebuild(): Promise<RebuildStatisticsResult> {
    await this.dataSource.transaction(async () => {
      await this.playerOpponentStatsRepo.clear();
      await this.playerStatsRepo.clear();
      await this.teamOpponentStatsRepo.clear();
      await this.teamStatsRepo.clear();
      await this.playerMatchGoalStatRepo.clear();
      await this.playerGoalRankingRepo.clear();
      await this.teamTournamentStatRepo.clear();
      await this.teamWorldCupTitleRepo.clear();
      await this.goalkeeperTournamentStatRepo.clear();
    });

    const matches = await this.matchRepo.find();
    const goals = await this.goalRepo.find();
    const playerAppearances = await this.playerAppearanceRepo.find();

    const playerStats = new Map<string, PlayerStats>();
    const playerOpponentStats = new Map<string, PlayerOpponentStats>();
    const teamStats = new Map<string, TeamStats>();
    const teamOpponentStats = new Map<string, TeamOpponentStats>();
    const playerMatchGoalStats = new Map<string, PlayerMatchGoalStat>();
    const teamTournamentStats = new Map<string, TeamTournamentStat>();
    const goalkeeperTournamentStats = new Map<string, GoalkeeperTournamentStat>();
    const matchesById = new Map(matches.map((match) => [match.match_id, match]));

    const getTeamStats = (teamId: string) =>
      getOrCreate(teamStats, teamId, () =>
        this.teamStatsRepo.create({ team_id: teamId }),
      );

    const getTeamOpponentStats = (teamId: string, opponentId: string) =>
      getOrCreate(teamOpponentStats, `${teamId}:${opponentId}`, () =>
        this.teamOpponentStatsRepo.create({
          team_id: teamId,
          opponent_team_id: opponentId,
        }),
      );

    const applyTeamMatch = (match: Match, teamId: string, opponentId: string) => {
      const team = getTeamStats(teamId);
      const opponent = getTeamOpponentStats(teamId, opponentId);
      const goalsForTeam =
        teamId === match.home_team_id ? match.home_score : match.away_score;
      const goalsAgainstTeam =
        teamId === match.home_team_id ? match.away_score : match.home_score;

      team.matches += 1;
      opponent.matches += 1;
      team.goals_for += goalsForTeam;
      team.goals_against += goalsAgainstTeam;
      opponent.goals_for += goalsForTeam;
      opponent.goals_against += goalsAgainstTeam;

      if (goalsAgainstTeam === 0) team.clean_sheets += 1;

      if (match.winner === "0") {
        team.draws += 1;
        opponent.draws += 1;
      } else if (match.winner === teamId) {
        team.wins += 1;
        opponent.wins += 1;
      } else {
        team.losses += 1;
        opponent.losses += 1;
      }

      const tournamentKey = `${match.world_cup_year}:${teamId}`;
      const tournament = getOrCreate(teamTournamentStats, tournamentKey, () =>
        this.teamTournamentStatRepo.create({
          tournament_id: String(match.world_cup_year),
          world_cup_year: match.world_cup_year,
          team_id: teamId,
          last_stage_name: match.stage_name,
        }),
      );
      tournament.matches += 1;
      tournament.goals_for += goalsForTeam;
      tournament.goals_against += goalsAgainstTeam;
      if (goalsAgainstTeam === 0) tournament.clean_sheets += 1;
      if (goalsForTeam === 0) tournament.scoreless_matches += 1;
      if (isKnockoutStage(match.stage_name)) tournament.reached_knockout = true;
      if (stageWeight(match.stage_name) >= stageWeight(tournament.last_stage_name)) {
        tournament.last_stage_name = match.stage_name;
      }
      if (match.winner === "0") tournament.draws += 1;
      else if (match.winner === teamId) tournament.wins += 1;
      else tournament.losses += 1;
    };

    for (const match of matches) {
      applyTeamMatch(match, match.home_team_id, match.away_team_id);
      applyTeamMatch(match, match.away_team_id, match.home_team_id);
    }

    for (const goal of goals) {
      const match = matchesById.get(goal.match_id);
      const opponentId = goal.scored_vs_team ?? this.inferOpponent(goal, match);
      if (!opponentId) continue;

      const player = getOrCreate(playerStats, goal.scored_by_player, () =>
        this.playerStatsRepo.create({ player_id: goal.scored_by_player }),
      );

      if (goal.own_goal) {
        player.own_goals += 1;
        const ownGoalKey = `${goal.match_id}:${goal.scored_by_player}`;
        const ownGoalMatchStat = getOrCreate(playerMatchGoalStats, ownGoalKey, () =>
          this.createPlayerMatchGoalStat(goal, match, opponentId),
        );
        ownGoalMatchStat.own_goals += 1;
        continue;
      }

      player.world_cup_goals += 1;
      if (goal.penalty) player.penalties_scored += 1;

      const key = `${goal.scored_by_player}:${opponentId}`;
      const playerOpponent = getOrCreate(playerOpponentStats, key, () =>
        this.playerOpponentStatsRepo.create({
          player_id: goal.scored_by_player,
          opponent_team_id: opponentId,
        }),
      );
      playerOpponent.goals += 1;
      if (goal.penalty) playerOpponent.penalties_scored += 1;

      const matchGoalKey = `${goal.match_id}:${goal.scored_by_player}`;
      const matchGoalStat = getOrCreate(playerMatchGoalStats, matchGoalKey, () =>
        this.createPlayerMatchGoalStat(goal, match, opponentId),
      );
      matchGoalStat.goals += 1;
      if (goal.penalty) matchGoalStat.penalties_scored += 1;
    }

    const titles = this.buildWorldCupTitles(matches);
    this.applyGoalkeeperStats(playerAppearances, matchesById, goalkeeperTournamentStats);
    const rankings = this.buildGoalRankings([...playerMatchGoalStats.values()]);

    await this.teamStatsRepo.save([...teamStats.values()]);
    await this.teamOpponentStatsRepo.save([...teamOpponentStats.values()]);
    await this.playerStatsRepo.save([...playerStats.values()]);
    await this.playerOpponentStatsRepo.save([...playerOpponentStats.values()]);
    await this.playerMatchGoalStatRepo.save([...playerMatchGoalStats.values()]);
    await this.playerGoalRankingRepo.save(rankings);
    await this.teamTournamentStatRepo.save([...teamTournamentStats.values()]);
    await this.teamWorldCupTitleRepo.save(titles);
    await this.goalkeeperTournamentStatRepo.save([
      ...goalkeeperTournamentStats.values(),
    ]);

    return {
      matchesProcessed: matches.length,
      goalsProcessed: goals.length,
      playerStats: playerStats.size,
      playerOpponentStats: playerOpponentStats.size,
      teamStats: teamStats.size,
      teamOpponentStats: teamOpponentStats.size,
      playerMatchGoalStats: playerMatchGoalStats.size,
      playerGoalRankings: rankings.length,
      teamTournamentStats: teamTournamentStats.size,
      teamWorldCupTitles: titles.length,
      goalkeeperTournamentStats: goalkeeperTournamentStats.size,
    };
  }

  private inferOpponent(goal: Goal, match: Match | undefined): string | null {
    if (!match) return null;
    if (goal.team_id === match.home_team_id) return match.away_team_id;
    if (goal.team_id === match.away_team_id) return match.home_team_id;
    return null;
  }

  private createPlayerMatchGoalStat(
    goal: Goal,
    match: Match | undefined,
    opponentId: string | null,
  ) {
    return this.playerMatchGoalStatRepo.create({
      tournament_id: String(goal.world_cup_year),
      world_cup_year: goal.world_cup_year,
      match_id: goal.match_id,
      player_id: goal.scored_by_player,
      team_id: goal.team_id,
      opponent_team_id: opponentId,
      stage_name: match?.stage_name ?? "Unknown",
      match_date: match?.date ?? null,
    });
  }

  private buildGoalRankings(matchGoalStats: PlayerMatchGoalStat[]) {
    const allTime = new Map<string, number>();
    const byTournament = new Map<string, number>();

    for (const stat of matchGoalStats) {
      if (stat.goals <= 0) continue;
      allTime.set(stat.player_id, (allTime.get(stat.player_id) ?? 0) + stat.goals);
      const tournamentKey = `${stat.world_cup_year}:${stat.player_id}`;
      byTournament.set(
        tournamentKey,
        (byTournament.get(tournamentKey) ?? 0) + stat.goals,
      );
    }

    return [
      ...rankEntries([...allTime.entries()]).map(([playerId, goals, rank]) =>
        this.playerGoalRankingRepo.create({
          scope: PlayerGoalRankingScope.AllTime,
          world_cup_year: null,
          player_id: playerId,
          goals,
          rank_position: rank,
        }),
      ),
      ...rankEntries([...byTournament.entries()]).map(([key, goals, rank]) => {
        const [year, playerId] = key.split(":");
        if (!year || !playerId) {
          throw new Error(`Invalid tournament ranking key: ${key}`);
        }
        return this.playerGoalRankingRepo.create({
          scope: PlayerGoalRankingScope.Tournament,
          world_cup_year: Number(year),
          player_id: playerId,
          goals,
          rank_position: rank,
        });
      }),
    ];
  }

  private buildWorldCupTitles(matches: Match[]) {
    const titles = new Map<string, number[]>();
    for (const match of matches) {
      if (!isFinal(match.stage_name) || match.winner === "0") continue;
      const years = titles.get(match.winner) ?? [];
      years.push(match.world_cup_year);
      titles.set(match.winner, years);
    }

    return [...titles.entries()].map(([teamId, years]) =>
      this.teamWorldCupTitleRepo.create({
        team_id: teamId,
        titles: years.length,
        years: years.sort((a, b) => a - b),
      }),
    );
  }

  private applyGoalkeeperStats(
    appearances: PlayerAppearance[],
    matchesById: Map<string, Match>,
    goalkeeperStats: Map<string, GoalkeeperTournamentStat>,
  ) {
    for (const appearance of appearances) {
      if (!isGoalkeeperAppearance(appearance)) continue;
      const match = matchesById.get(appearance.match_id);
      if (!match) continue;
      const goalsAgainst =
        appearance.team_id === match.home_team_id
          ? match.away_score
          : appearance.team_id === match.away_team_id
            ? match.home_score
            : 0;
      const key = `${match.world_cup_year}:${appearance.player_id}`;
      const stat = getOrCreate(goalkeeperStats, key, () =>
        this.goalkeeperTournamentStatRepo.create({
          tournament_id: String(match.world_cup_year),
          world_cup_year: match.world_cup_year,
          player_id: appearance.player_id,
          team_id: appearance.team_id,
        }),
      );
      stat.appearances += 1;
      stat.goals_conceded += goalsAgainst;
      if (goalsAgainst === 0) stat.clean_sheets += 1;
    }
  }
}

function getOrCreate<TKey, TValue>(
  map: Map<TKey, TValue>,
  key: TKey,
  factory: () => TValue,
): TValue {
  const existing = map.get(key);
  if (existing) return existing;

  const created = factory();
  map.set(key, created);
  return created;
}

function rankEntries(entries: [string, number][]): [string, number, number][] {
  const sorted = entries.sort((a, b) => b[1] - a[1]);
  let previousGoals: number | null = null;
  let previousRank = 0;
  return sorted.map(([id, goals], index) => {
    const rank = previousGoals === goals ? previousRank : index + 1;
    previousGoals = goals;
    previousRank = rank;
    return [id, goals, rank];
  });
}

function isKnockoutStage(stageName: string | null): boolean {
  const normalized = (stageName ?? "").toLowerCase();
  return !normalized.includes("group");
}

function stageWeight(stageName: string | null): number {
  const normalized = (stageName ?? "").toLowerCase();
  if (normalized.includes("final") && !normalized.includes("third")) return 6;
  if (normalized.includes("semi")) return 5;
  if (normalized.includes("quarter")) return 4;
  if (normalized.includes("round of 16") || normalized.includes("oct")) return 3;
  if (normalized.includes("group")) return 1;
  return 2;
}

function isFinal(stageName: string): boolean {
  const normalized = stageName.toLowerCase();
  return normalized.includes("final") && !normalized.includes("third");
}

function isGoalkeeperAppearance(appearance: PlayerAppearance): boolean {
  const code = (appearance.position_code ?? "").toLowerCase();
  const name = (appearance.position_name ?? "").toLowerCase();
  return code === "g" || code === "gk" || name.includes("goalkeeper");
}
