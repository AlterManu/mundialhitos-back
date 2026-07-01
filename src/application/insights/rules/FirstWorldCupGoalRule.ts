import { isGoalScoredEvent } from "@/domain/live/LiveEvent";
import { InsightImportance } from "@/domain/insights/InsightImportance";
import { InsightRule, InsightRuleContext } from "@/domain/insights/InsightRule";
import { InsightScope } from "@/entities/Insight";

export class FirstWorldCupGoalRule implements InsightRule {
  readonly id = "first-world-cup-goal";

  evaluate(context: InsightRuleContext) {
    const { event, statistics } = context;
    if (!isGoalScoredEvent(event) || event.ownGoal || !statistics.goal) return [];

    const previousGoals = statistics.goal.playerBefore?.world_cup_goals ?? 0;
    if (previousGoals !== 0) return [];

    return [
      {
        type: this.id,
        scope: InsightScope.Player,
        subjectId: event.playerId,
        matchId: event.matchId,
        dedupeKey: `${this.id}:${event.playerId}`,
        importanceScore: InsightImportance.High,
        title: "Primer gol mundialista",
        body: `El jugador ${event.playerId} marcó su primer gol en una Copa del Mundo.`,
        facts: {
          playerId: event.playerId,
          teamId: event.teamId,
          opponentId: event.opponentId,
          minute: event.minute,
        },
      },
    ];
  }
}
