import { isGoalScoredEvent } from "@/domain/live/LiveEvent";
import { InsightCandidate } from "@/domain/insights/InsightCandidate";
import { InsightImportance } from "@/domain/insights/InsightImportance";
import { InsightRule, InsightRuleContext } from "@/domain/insights/InsightRule";
import { InsightPhase, InsightScope } from "@/entities/Insight";

export class PlayerAssistRankingRule implements InsightRule {
  readonly id = "player-assist-ranking";

  evaluate(context: InsightRuleContext) {
    const { event, statistics } = context;
    const goalContext = statistics.context?.goal;
    if (
      !isGoalScoredEvent(event) ||
      event.ownGoal ||
      !event.assistPlayerId ||
      !goalContext
    ) {
      return [];
    }

    const insights: InsightCandidate[] = [];
    if (
      goalContext.assistAllTimeRankAfter !== null &&
      goalContext.assistAllTimeRankAfter <= 10 &&
      (goalContext.assistAllTimeRankBefore === null ||
        goalContext.assistAllTimeRankBefore > goalContext.assistAllTimeRankAfter)
    ) {
      insights.push({
        type: `${this.id}-all-time-top-10`,
        phase: InsightPhase.Live,
        scope: InsightScope.Player,
        subjectId: event.assistPlayerId,
        matchId: event.matchId,
        dedupeKey: `${this.id}:all-time:${event.assistPlayerId}:${goalContext.assistAllTimeRankAfter}`,
        importanceScore:
          goalContext.assistAllTimeRankAfter <= 3
            ? InsightImportance.Historic
            : InsightImportance.High,
        title: "Sube entre los asistidores historicos",
        body: `${goalContext.assistPlayerName} se coloca en el puesto ${goalContext.assistAllTimeRankAfter} de asistidores historicos de los Mundiales.`,
        facts: {
          playerId: event.assistPlayerId,
          rankBefore: goalContext.assistAllTimeRankBefore,
          rankAfter: goalContext.assistAllTimeRankAfter,
          assists: goalContext.assistTotalAfter,
        },
      });
    }

    if (
      goalContext.assistNationalRankAfter !== null &&
      goalContext.assistNationalRankAfter <= 10 &&
      (goalContext.assistNationalRankBefore === null ||
        goalContext.assistNationalRankBefore > goalContext.assistNationalRankAfter)
    ) {
      insights.push({
        type: `${this.id}-national-top-10`,
        phase: InsightPhase.Live,
        scope: InsightScope.Player,
        subjectId: event.assistPlayerId,
        matchId: event.matchId,
        dedupeKey: `${this.id}:national:${event.teamId}:${event.assistPlayerId}:${goalContext.assistNationalRankAfter}`,
        importanceScore:
          goalContext.assistNationalRankAfter <= 3
            ? InsightImportance.Historic
            : InsightImportance.High,
        title: "Sube entre los asistidores de su seleccion",
        body: `${goalContext.assistPlayerName} se coloca en el puesto ${goalContext.assistNationalRankAfter} de asistidores mundialistas de ${goalContext.teamName}.`,
        facts: {
          playerId: event.assistPlayerId,
          teamId: event.teamId,
          rankBefore: goalContext.assistNationalRankBefore,
          rankAfter: goalContext.assistNationalRankAfter,
          assists: goalContext.assistTotalAfter,
        },
      });
    }

    return insights;
  }
}
