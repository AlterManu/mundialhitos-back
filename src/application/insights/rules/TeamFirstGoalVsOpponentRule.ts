import { isGoalScoredEvent } from "@/domain/live/LiveEvent";
import { InsightImportance } from "@/domain/insights/InsightImportance";
import { InsightRule, InsightRuleContext } from "@/domain/insights/InsightRule";
import { InsightPhase, InsightScope } from "@/entities/Insight";

export class TeamFirstGoalVsOpponentRule implements InsightRule {
  readonly id = "team-first-goal-vs-opponent";

  evaluate(context: InsightRuleContext) {
    const { event, statistics } = context;
    const goalContext = statistics.context?.goal;
    if (!isGoalScoredEvent(event) || !statistics.goal || !goalContext) return [];

    const previousGoals = statistics.goal.teamVsOpponentBefore?.goals_for ?? 0;
    if (previousGoals !== 0) return [];

    return [
      {
        type: this.id,
        phase: InsightPhase.Live,
        scope: InsightScope.HeadToHead,
        subjectId: `${event.teamId}:${event.opponentId}`,
        matchId: event.matchId,
        dedupeKey: `${this.id}:${event.teamId}:${event.opponentId}`,
        importanceScore: InsightImportance.Medium,
        title: "Primer gol historico ante este rival",
        body: `${goalContext.teamName} marco por primera vez ante ${goalContext.opponentName} en Mundiales.`,
        facts: {
          teamId: event.teamId,
          opponentId: event.opponentId,
        },
      },
    ];
  }
}
