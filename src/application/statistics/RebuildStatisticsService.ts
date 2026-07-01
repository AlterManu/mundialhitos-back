import { DataSource, Repository } from "typeorm";
import { Goal } from "@/entities/Goal";
import { Match } from "@/entities/Match";
import { PlayerOpponentStats } from "@/entities/PlayerOpponentStats";
import { PlayerStats } from "@/entities/PlayerStats";
import { TeamOpponentStats } from "@/entities/TeamOpponentStats";
import { TeamStats } from "@/entities/TeamStats";

export interface RebuildStatisticsResult {
  matchesProcessed: number;
  goalsProcessed: number;
  playerStats: number;
  playerOpponentStats: number;
  teamStats: number;
  teamOpponentStats: number;
}

export class RebuildStatisticsService {
  private readonly matchRepo: Repository<Match>;
  private readonly goalRepo: Repository<Goal>;
  private readonly playerStatsRepo: Repository<PlayerStats>;
  private readonly playerOpponentStatsRepo: Repository<PlayerOpponentStats>;
  private readonly teamStatsRepo: Repository<TeamStats>;
  private readonly teamOpponentStatsRepo: Repository<TeamOpponentStats>;

  constructor(private readonly dataSource: DataSource) {
    this.matchRepo = dataSource.getRepository(Match);
    this.goalRepo = dataSource.getRepository(Goal);
    this.playerStatsRepo = dataSource.getRepository(PlayerStats);
    this.playerOpponentStatsRepo = dataSource.getRepository(PlayerOpponentStats);
    this.teamStatsRepo = dataSource.getRepository(TeamStats);
    this.teamOpponentStatsRepo = dataSource.getRepository(TeamOpponentStats);
  }

  async rebuild(): Promise<RebuildStatisticsResult> {
    await this.dataSource.transaction(async () => {
      await this.playerOpponentStatsRepo.clear();
      await this.playerStatsRepo.clear();
      await this.teamOpponentStatsRepo.clear();
      await this.teamStatsRepo.clear();
    });

    const matches = await this.matchRepo.find();
    const goals = await this.goalRepo.find();

    const playerStats = new Map<string, PlayerStats>();
    const playerOpponentStats = new Map<string, PlayerOpponentStats>();
    const teamStats = new Map<string, TeamStats>();
    const teamOpponentStats = new Map<string, TeamOpponentStats>();
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
    }

    await this.teamStatsRepo.save([...teamStats.values()]);
    await this.teamOpponentStatsRepo.save([...teamOpponentStats.values()]);
    await this.playerStatsRepo.save([...playerStats.values()]);
    await this.playerOpponentStatsRepo.save([...playerOpponentStats.values()]);

    return {
      matchesProcessed: matches.length,
      goalsProcessed: goals.length,
      playerStats: playerStats.size,
      playerOpponentStats: playerOpponentStats.size,
      teamStats: teamStats.size,
      teamOpponentStats: teamOpponentStats.size,
    };
  }

  private inferOpponent(goal: Goal, match: Match | undefined): string | null {
    if (!match) return null;
    if (goal.team_id === match.home_team_id) return match.away_team_id;
    if (goal.team_id === match.away_team_id) return match.home_team_id;
    return null;
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
