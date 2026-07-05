import { isGoalScoredEvent } from "@/domain/live/LiveEvent";
import { InsightCandidate } from "@/domain/insights/InsightCandidate";
import { InsightImportance } from "@/domain/insights/InsightImportance";
import { InsightRule, InsightRuleContext } from "@/domain/insights/InsightRule";
import { InsightPhase, InsightScope } from "@/entities/Insight";

export class PlayerMultiGoalMatchRule implements InsightRule {
  readonly id = "player-multi-goal-match";

  evaluate(context: InsightRuleContext) {
    const { event } = context;
    const goalContext = context.statistics.context?.goal;
    if (!isGoalScoredEvent(event) || event.ownGoal || !goalContext) return [];

    const goals = goalContext.currentMatchPlayerGoalsAfter;
    if (goals !== 2 && goals !== 3) return [];

    const label = goals === 2 ? "doblete" : "hat trick";
    const labelSlug = goals === 2 ? "doblete" : "hat-trick";
    const previousCount =
      goals === 2
        ? goalContext.previousPlayerMultiGoalMatches
        : goalContext.previousPlayerHatTricks;
    const previousVsOpponent =
      goals === 2
        ? goalContext.previousPlayerMultiGoalMatchesVsOpponent
        : goalContext.previousPlayerHatTricksVsOpponent;

    const insights: InsightCandidate[] = [];

    if (previousCount === 0) {
      insights.push({
        type: `${this.id}-first-career-${labelSlug}`,
        phase: InsightPhase.Live,
        scope: InsightScope.Player,
        subjectId: event.playerId,
        matchId: event.matchId,
        dedupeKey: `${this.id}:first-career:${labelSlug}:${event.playerId}`,
        importanceScore:
          goals === 3 ? InsightImportance.Historic : InsightImportance.High,
        title: goals === 2 ? "Primer doblete mundialista" : "Primer hat trick mundialista",
        body: `El jugador ${event.playerId} logra su primer ${label} en una Copa del Mundo.`,
        facts: { playerId: event.playerId, goals },
      });
    }

    if (previousVsOpponent === 0) {
      insights.push({
        type: `${this.id}-first-vs-opponent-${labelSlug}`,
        phase: InsightPhase.Live,
        scope: InsightScope.Player,
        subjectId: event.playerId,
        matchId: event.matchId,
        dedupeKey: `${this.id}:first-vs-opponent:${labelSlug}:${event.playerId}:${event.opponentId}`,
        importanceScore:
          goals === 3 ? InsightImportance.High : InsightImportance.Medium,
        title: goals === 2 ? "Primer doblete ante este rival" : "Primer hat trick ante este rival",
        body: `El jugador ${event.playerId} nunca le había marcado un ${label} a ${event.opponentId} en Mundiales.`,
        facts: { playerId: event.playerId, opponentId: event.opponentId, goals },
      });
    } else if (goalContext.lastPlayerMultiGoalMatchVsOpponentYear) {
      insights.push({
        type: `${this.id}-last-vs-opponent-${labelSlug}`,
        phase: InsightPhase.Live,
        scope: InsightScope.Player,
        subjectId: event.playerId,
        matchId: event.matchId,
        dedupeKey: `${this.id}:last-vs-opponent:${labelSlug}:${event.playerId}:${event.opponentId}:${event.matchId}`,
        importanceScore: InsightImportance.Medium,
        title: goals === 2 ? "Repite doblete ante este rival" : "Repite hat trick ante este rival",
        body: `El último ${label} de ${event.playerId} ante ${event.opponentId} había sido en ${goalContext.lastPlayerMultiGoalMatchVsOpponentYear}.`,
        facts: {
          previousYear: goalContext.lastPlayerMultiGoalMatchVsOpponentYear,
          playerId: event.playerId,
          opponentId: event.opponentId,
        },
      });
    }

    if (goalContext.lastAnyPlayerMultiGoalAgainstOpponentYear) {
      insights.push({
        type: `${this.id}-last-any-against-opponent-${labelSlug}`,
        phase: InsightPhase.Live,
        scope: InsightScope.Team,
        subjectId: event.opponentId,
        matchId: event.matchId,
        dedupeKey: `${this.id}:last-any-against-opponent:${labelSlug}:${event.opponentId}:${event.matchId}`,
        importanceScore: InsightImportance.Medium,
        title: goals === 2 ? "Otro doblete recibido" : "Otro hat trick recibido",
        body: `La última vez que ${event.opponentId} recibió un ${label} en Mundiales fue en ${goalContext.lastAnyPlayerMultiGoalAgainstOpponentYear}.`,
        facts: {
          opponentId: event.opponentId,
          previousYear: goalContext.lastAnyPlayerMultiGoalAgainstOpponentYear,
        },
      });
    }

    return insights;
  }
}
