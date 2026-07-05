import { isGoalScoredEvent } from "@/domain/live/LiveEvent";
import { InsightImportance } from "@/domain/insights/InsightImportance";
import { InsightRule, InsightRuleContext } from "@/domain/insights/InsightRule";
import { InsightPhase, InsightScope } from "@/entities/Insight";

export class GoalkeeperConcededRankingRule implements InsightRule {
  readonly id = "goalkeeper-conceded-ranking";

  evaluate(context: InsightRuleContext) {
    const goalContext = context.statistics.context?.goal;
    if (!isGoalScoredEvent(context.event) || !goalContext?.concedingGoalkeeperId) {
      return [];
    }

    const rank = goalContext.goalkeeperTournamentGoalsConcededRankAfter;
    const goalsConceded = goalContext.goalkeeperTournamentGoalsConcededAfter;
    if (!rank || rank > 5 || goalsConceded < 2) return [];

    return [
      {
        type: this.id,
        phase: InsightPhase.Live,
        scope: InsightScope.Player,
        subjectId: goalContext.concedingGoalkeeperId,
        matchId: context.event.matchId,
        dedupeKey: `${this.id}:${goalContext.concedingGoalkeeperId}:${context.event.matchId}:${goalsConceded}`,
        importanceScore: rank === 1 ? InsightImportance.High : InsightImportance.Medium,
        title: "Entre los arqueros mas vencidos del Mundial",
        body: `El arquero ${goalContext.concedingGoalkeeperId} suma ${goalsConceded} goles recibidos en este Mundial y queda en el puesto ${rank}.`,
        facts: {
          goalkeeperId: goalContext.concedingGoalkeeperId,
          goalsConceded,
          rank,
          teamId: context.event.opponentId,
        },
      },
    ];
  }
}
