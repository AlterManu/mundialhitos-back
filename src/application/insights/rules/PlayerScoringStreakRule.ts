import { isGoalScoredEvent } from "@/domain/live/LiveEvent";
import { InsightImportance } from "@/domain/insights/InsightImportance";
import { InsightRule, InsightRuleContext } from "@/domain/insights/InsightRule";
import { InsightPhase, InsightScope } from "@/entities/Insight";

export class PlayerScoringStreakRule implements InsightRule {
  readonly id = "player-scoring-streak";

  evaluate(context: InsightRuleContext) {
    const { event, statistics } = context;
    const goalContext = statistics.context?.goal;
    if (!isGoalScoredEvent(event) || event.ownGoal || !goalContext) return [];

    const streak = goalContext.scoringStreakAfter;
    if (streak < 3) return [];

    return [
      {
        type: this.id,
        phase: InsightPhase.Live,
        scope: InsightScope.Player,
        subjectId: event.playerId,
        matchId: event.matchId,
        dedupeKey: `${this.id}:${event.playerId}:${streak}`,
        importanceScore: streak >= 5 ? InsightImportance.Historic : InsightImportance.High,
        title: "Racha goleadora",
        body: `El jugador ${event.playerId} marcó en ${streak} partidos mundialistas consecutivos.`,
        facts: {
          playerId: event.playerId,
          streakBefore: goalContext.scoringStreakBefore,
          streakAfter: streak,
        },
      },
    ];
  }
}
