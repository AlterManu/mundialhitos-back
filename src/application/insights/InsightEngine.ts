import { LiveEvent } from "@/domain/live/LiveEvent";
import { InsightCandidate } from "@/domain/insights/InsightCandidate";
import { InsightRule } from "@/domain/insights/InsightRule";
import { StatisticsUpdateResult } from "@/domain/statistics/StatisticsSnapshot";
import { FirstGoalVsOpponentRule } from "./rules/FirstGoalVsOpponentRule";
import { FirstWorldCupGoalRule } from "./rules/FirstWorldCupGoalRule";
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
    ]);
  }

  evaluate(event: LiveEvent, statistics: StatisticsUpdateResult): InsightCandidate[] {
    const candidates = this.rules.flatMap((rule) =>
      rule.evaluate({ event, statistics }),
    );

    return this.scorer.filterPublishable(this.deduplicator.dedupe(candidates));
  }
}
