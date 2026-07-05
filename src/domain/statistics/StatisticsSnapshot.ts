import { PlayerOpponentStats } from "@/entities/PlayerOpponentStats";
import { PlayerStats } from "@/entities/PlayerStats";
import { TeamOpponentStats } from "@/entities/TeamOpponentStats";
import { TeamStats } from "@/entities/TeamStats";

export interface GoalStatisticsSnapshot {
  playerBefore: PlayerStats | null;
  playerAfter: PlayerStats;
  playerVsOpponentBefore: PlayerOpponentStats | null;
  playerVsOpponentAfter: PlayerOpponentStats;
  teamBefore: TeamStats | null;
  teamAfter: TeamStats;
  teamVsOpponentBefore: TeamOpponentStats | null;
  teamVsOpponentAfter: TeamOpponentStats;
}

export interface StatisticsUpdateResult {
  goal?: GoalStatisticsSnapshot;
  appearance?: SubstitutionInsightContext;
  context?: InsightEventContext;
}

export interface InsightEventContext {
  goal?: GoalEventInsightContext;
  substitution?: SubstitutionInsightContext;
}

export interface GoalEventInsightContext {
  currentMatchPlayerGoalsBefore: number;
  currentMatchPlayerGoalsAfter: number;
  currentMatchTeamGoalsForBefore: number;
  currentMatchTeamGoalsForAfter: number;
  currentMatchOpponentGoalsAgainstBefore: number;
  currentMatchOpponentGoalsAgainstAfter: number;
  previousPlayerMultiGoalMatches: number;
  previousPlayerHatTricks: number;
  previousPlayerMultiGoalMatchesVsOpponent: number;
  previousPlayerHatTricksVsOpponent: number;
  lastPlayerMultiGoalMatchYear: number | null;
  lastPlayerMultiGoalMatchVsOpponentYear: number | null;
  lastAnyPlayerMultiGoalAgainstOpponentYear: number | null;
  allTimeGoalRankBefore: number | null;
  allTimeGoalRankAfter: number | null;
  tournamentGoalRankBefore: number | null;
  tournamentGoalRankAfter: number | null;
  penaltyGoalsBefore: number;
  penaltyGoalsAfter: number;
  penaltyMissesBefore: number;
  ownGoalsBefore: number;
  ownGoalsAfter: number;
  ownGoalRankAfter: number | null;
  scoringStreakBefore: number;
  scoringStreakAfter: number;
  concedingGoalkeeperId: string | null;
  goalkeeperTournamentGoalsConcededBefore: number;
  goalkeeperTournamentGoalsConcededAfter: number;
  goalkeeperTournamentGoalsConcededRankAfter: number | null;
}

export interface SubstitutionInsightContext {
  enteringPlayerId: string | null;
  previousAppearances: number;
  previousTournamentAppearances: number;
}
