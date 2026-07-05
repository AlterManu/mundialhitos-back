import { LiveEvent } from "@/domain/live/LiveEvent";
import { InsightCandidate } from "@/domain/insights/InsightCandidate";
import { InsightRule } from "@/domain/insights/InsightRule";
import { StatisticsUpdateResult } from "@/domain/statistics/StatisticsSnapshot";
import { FirstGoalVsOpponentRule } from "./rules/FirstGoalVsOpponentRule";
import { FirstWorldCupGoalRule } from "./rules/FirstWorldCupGoalRule";
import { GoalkeeperConcededRankingRule } from "./rules/GoalkeeperConcededRankingRule";
import { OwnGoalInsightRule } from "./rules/OwnGoalInsightRule";
import { PenaltyInsightRule } from "./rules/PenaltyInsightRule";
import { PlayerDebutRule } from "./rules/PlayerDebutRule";
import { PlayerGoalRankingRule } from "./rules/PlayerGoalRankingRule";
import { PlayerMultiGoalMatchRule } from "./rules/PlayerMultiGoalMatchRule";
import { PlayerScoringStreakRule } from "./rules/PlayerScoringStreakRule";
import { TeamConcededThresholdRule } from "./rules/TeamConcededThresholdRule";
import { TeamFirstGoalVsOpponentRule } from "./rules/TeamFirstGoalVsOpponentRule";
import { TeamGoalMilestoneRule } from "./rules/TeamGoalMilestoneRule";
import { InsightDeduplicator } from "./InsightDeduplicator";
import { InsightScorer } from "./InsightScorer";

export class InsightEngine {
  constructor(
    private readonly rules: InsightRule[],
    private readonly scorer = new InsightScorer(),
    private readonly deduplicator = new InsightDeduplicator(),
  ) {}

  static createDefault() {
    return new InsightEngine([
      new FirstWorldCupGoalRule(),
      new FirstGoalVsOpponentRule(),
      new TeamFirstGoalVsOpponentRule(),
      new TeamGoalMilestoneRule(),
      new PlayerDebutRule(),
      new PlayerMultiGoalMatchRule(),
      new PlayerGoalRankingRule(),
      new PenaltyInsightRule(),
      new OwnGoalInsightRule(),
      new TeamConcededThresholdRule(),
      new PlayerScoringStreakRule(),
      new GoalkeeperConcededRankingRule(),
    ]);
  }

  evaluate(event: LiveEvent, statistics: StatisticsUpdateResult): InsightCandidate[] {
    const candidates = this.rules.flatMap((rule) =>
      rule.evaluate({ event, statistics }),
    );

    return this.scorer.filterPublishable(this.deduplicator.dedupe(candidates));
  }
}
