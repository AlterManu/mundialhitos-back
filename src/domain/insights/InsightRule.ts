import { LiveEvent } from "@/domain/live/LiveEvent";
import { StatisticsUpdateResult } from "@/domain/statistics/StatisticsSnapshot";
import { InsightCandidate } from "./InsightCandidate";

export interface InsightRuleContext {
  event: LiveEvent;
  statistics: StatisticsUpdateResult;
}

export interface InsightRule {
  readonly id: string;
  evaluate(context: InsightRuleContext): InsightCandidate[];
}
