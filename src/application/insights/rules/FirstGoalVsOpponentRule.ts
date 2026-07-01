import { isGoalScoredEvent } from "@/domain/live/LiveEvent";
import { InsightImportance } from "@/domain/insights/InsightImportance";
import { InsightRule, InsightRuleContext } from "@/domain/insights/InsightRule";
import { InsightScope } from "@/entities/Insight";

export class FirstGoalVsOpponentRule implements InsightRule {
  readonly id = "first-goal-vs-opponent";

  evaluate(context: InsightRuleContext) {
    const { event, statistics } = context;
    if (!isGoalScoredEvent(event) || event.ownGoal || !statistics.goal) return [];

    const previousGoals =
      statistics.goal.playerVsOpponentBefore?.goals ?? 0;
    if (previousGoals !== 0) return [];

    return [
      {
        type: this.id,
        scope: InsightScope.Player,
        subjectId: event.playerId,
        matchId: event.matchId,
        dedupeKey: `${this.id}:${event.playerId}:${event.opponentId}`,
        importanceScore: InsightImportance.Medium,
        title: "Primer gol ante este rival",
        body: `El jugador ${event.playerId} marcó por primera vez contra ${event.opponentId} en Mundiales.`,
        facts: {
          playerId: event.playerId,
          opponentId: event.opponentId,
          newTotal: statistics.goal.playerVsOpponentAfter.goals,
        },
      },
    ];
  }
}
