import { isGoalScoredEvent } from "@/domain/live/LiveEvent";
import { InsightCandidate } from "@/domain/insights/InsightCandidate";
import { InsightImportance } from "@/domain/insights/InsightImportance";
import { InsightRule, InsightRuleContext } from "@/domain/insights/InsightRule";
import { InsightPhase, InsightScope } from "@/entities/Insight";

export class PlayerGoalRankingRule implements InsightRule {
  readonly id = "player-goal-ranking";

  evaluate(context: InsightRuleContext) {
    const { event, statistics } = context;
    const goalContext = statistics.context?.goal;
    if (!isGoalScoredEvent(event) || event.ownGoal || !goalContext) return [];

    const insights: InsightCandidate[] = [];
    if (
      goalContext.allTimeGoalRankAfter !== null &&
      goalContext.allTimeGoalRankAfter <= 10 &&
      (goalContext.allTimeGoalRankBefore === null ||
        goalContext.allTimeGoalRankBefore > goalContext.allTimeGoalRankAfter)
    ) {
      insights.push({
        type: `${this.id}-all-time-top-10`,
        phase: InsightPhase.Live,
        scope: InsightScope.Player,
        subjectId: event.playerId,
        matchId: event.matchId,
        dedupeKey: `${this.id}:all-time:${event.playerId}:${goalContext.allTimeGoalRankAfter}`,
        importanceScore:
          goalContext.allTimeGoalRankAfter <= 3
            ? InsightImportance.Historic
            : InsightImportance.High,
        title: "Sube en la tabla historica",
        body: `${goalContext.playerName} se coloca en el puesto ${goalContext.allTimeGoalRankAfter} de goleadores historicos de los Mundiales.`,
        facts: {
          playerId: event.playerId,
          rankBefore: goalContext.allTimeGoalRankBefore,
          rankAfter: goalContext.allTimeGoalRankAfter,
        },
      });
    }

    if (
      goalContext.tournamentGoalRankAfter !== null &&
      goalContext.tournamentGoalRankAfter <= 10 &&
      goalContext.tournamentTotalGoalsAfter >= 10 &&
      (goalContext.tournamentGoalRankBefore === null ||
        goalContext.tournamentGoalRankBefore > goalContext.tournamentGoalRankAfter)
    ) {
      insights.push({
        type: `${this.id}-tournament-top-10`,
        phase: InsightPhase.Live,
        scope: InsightScope.Player,
        subjectId: event.playerId,
        matchId: event.matchId,
        dedupeKey: `${this.id}:tournament:${event.matchId}:${event.playerId}:${goalContext.tournamentGoalRankAfter}`,
        importanceScore: InsightImportance.Medium,
        title: "Se mete en la pelea de goleadores",
        body: `${goalContext.playerName} entra en el top ${goalContext.tournamentGoalRankAfter} de goleadores de este Mundial.`,
        facts: {
          playerId: event.playerId,
          rankBefore: goalContext.tournamentGoalRankBefore,
          rankAfter: goalContext.tournamentGoalRankAfter,
          tournamentTotalGoals: goalContext.tournamentTotalGoalsAfter,
        },
      });
    }

    if (
      goalContext.nationalGoalRankAfter !== null &&
      goalContext.nationalGoalRankAfter <= 10 &&
      (goalContext.nationalGoalRankBefore === null ||
        goalContext.nationalGoalRankBefore > goalContext.nationalGoalRankAfter)
    ) {
      insights.push({
        type: `${this.id}-national-top-10`,
        phase: InsightPhase.Live,
        scope: InsightScope.Player,
        subjectId: event.playerId,
        matchId: event.matchId,
        dedupeKey: `${this.id}:national:${event.teamId}:${event.playerId}:${goalContext.nationalGoalRankAfter}`,
        importanceScore:
          goalContext.nationalGoalRankAfter <= 3
            ? InsightImportance.Historic
            : InsightImportance.High,
        title: "Sube en la historia de su seleccion",
        body: `${goalContext.playerName} se coloca en el puesto ${goalContext.nationalGoalRankAfter} de goleadores mundialistas de ${goalContext.teamName}.`,
        facts: {
          playerId: event.playerId,
          teamId: event.teamId,
          rankBefore: goalContext.nationalGoalRankBefore,
          rankAfter: goalContext.nationalGoalRankAfter,
        },
      });
    }

    return insights;
  }
}
