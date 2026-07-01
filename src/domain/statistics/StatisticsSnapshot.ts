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
}
