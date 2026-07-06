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
  card?: CardEventInsightContext;
  substitution?: SubstitutionInsightContext;
}

export interface GoalEventInsightContext {
  playerName: string;
  teamName: string;
  opponentName: string;
  assistPlayerName: string | null;
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
  lastPlayerHatTrickVsOpponentYear: number | null;
  lastAnyPlayerMultiGoalAgainstOpponentYear: number | null;
  lastAnyPlayerHatTrickAgainstOpponentYear: number | null;
  allTimeGoalRankBefore: number | null;
  allTimeGoalRankAfter: number | null;
  nationalGoalRankBefore: number | null;
  nationalGoalRankAfter: number | null;
  tournamentGoalRankBefore: number | null;
  tournamentGoalRankAfter: number | null;
  tournamentTotalGoalsBefore: number;
  tournamentTotalGoalsAfter: number;
  penaltyGoalsBefore: number;
  penaltyGoalsAfter: number;
  allTimePenaltyGoalRankBefore: number | null;
  allTimePenaltyGoalRankAfter: number | null;
  nationalPenaltyGoalRankBefore: number | null;
  nationalPenaltyGoalRankAfter: number | null;
  penaltyMissesBefore: number;
  assistAllTimeRankBefore: number | null;
  assistAllTimeRankAfter: number | null;
  assistNationalRankBefore: number | null;
  assistNationalRankAfter: number | null;
  assistTotalBefore: number | null;
  assistTotalAfter: number | null;
  ownGoalsBefore: number;
  ownGoalsAfter: number;
  ownGoalRankAfter: number | null;
  scoringStreakBefore: number;
  scoringStreakAfter: number;
  concedingGoalkeeperId: string | null;
  concedingGoalkeeperName: string | null;
  goalkeeperTournamentGoalsConcededBefore: number;
  goalkeeperTournamentGoalsConcededAfter: number;
  goalkeeperTournamentGoalsConcededRankAfter: number | null;
}

export interface CardEventInsightContext {
  playerName: string;
  teamName: string | null;
  rankings: CardRankingInsightContext[];
}

export interface CardRankingInsightContext {
  metric: "yellow_cards" | "red_cards";
  label: string;
  totalBefore: number;
  totalAfter: number;
  allTimeRankBefore: number | null;
  allTimeRankAfter: number | null;
  nationalRankBefore: number | null;
  nationalRankAfter: number | null;
}

export interface SubstitutionInsightContext {
  enteringPlayerId: string | null;
  enteringPlayerName: string | null;
  teamName: string | null;
  teamHasWorldCupTitle: boolean;
  previousAppearances: number;
  previousTournamentAppearances: number;
}
