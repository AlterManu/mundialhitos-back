import { isGoalScoredEvent } from "@/domain/live/LiveEvent";
import { InsightCandidate } from "@/domain/insights/InsightCandidate";
import { InsightImportance } from "@/domain/insights/InsightImportance";
import { InsightRule, InsightRuleContext } from "@/domain/insights/InsightRule";
import { InsightPhase, InsightScope } from "@/entities/Insight";

export class OwnGoalInsightRule implements InsightRule {
  readonly id = "own-goal-insight";

  evaluate(context: InsightRuleContext) {
    const { event, statistics } = context;
    const goalContext = statistics.context?.goal;
    if (!isGoalScoredEvent(event) || !event.ownGoal || !goalContext) return [];

    const insights: InsightCandidate[] = [
      {
        type: `${this.id}-player`,
        phase: InsightPhase.Live,
        scope: InsightScope.Player,
        subjectId: event.playerId,
        matchId: event.matchId,
        dedupeKey: `${this.id}:player:${event.playerId}:${event.matchId}`,
        importanceScore:
          goalContext.ownGoalsAfter === 1
            ? InsightImportance.High
            : InsightImportance.Medium,
        title:
          goalContext.ownGoalsAfter === 1
            ? "Primer gol en contra"
            : "Otro gol en contra",
        body: `${goalContext.playerName} suma ${goalContext.ownGoalsAfter} gol(es) en contra en Mundiales.`,
        facts: {
          playerId: event.playerId,
          ownGoalsBefore: goalContext.ownGoalsBefore,
          ownGoalsAfter: goalContext.ownGoalsAfter,
        },
      },
    ];

    if (goalContext.ownGoalRankAfter !== null && goalContext.ownGoalRankAfter <= 5) {
      insights.push({
        type: `${this.id}-ranking`,
        phase: InsightPhase.Live,
        scope: InsightScope.Player,
        subjectId: event.playerId,
        matchId: event.matchId,
        dedupeKey: `${this.id}:ranking:${event.playerId}:${goalContext.ownGoalRankAfter}`,
        importanceScore: InsightImportance.Medium,
        title: "Entre los que mas goles en contra tienen",
        body: `${goalContext.playerName} queda en el puesto ${goalContext.ownGoalRankAfter} historico de goles en contra en Mundiales.`,
        facts: {
          playerId: event.playerId,
          rankAfter: goalContext.ownGoalRankAfter,
        },
      });
    }

    return insights;
  }
}
