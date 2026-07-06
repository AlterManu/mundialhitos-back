import { isGoalScoredEvent } from "@/domain/live/LiveEvent";
import { InsightCandidate } from "@/domain/insights/InsightCandidate";
import { InsightImportance } from "@/domain/insights/InsightImportance";
import { InsightRule, InsightRuleContext } from "@/domain/insights/InsightRule";
import { InsightPhase, InsightScope } from "@/entities/Insight";
import { LiveEventKind } from "@/entities/LiveEventLog";

export class PenaltyInsightRule implements InsightRule {
  readonly id = "penalty-insight";

  evaluate(context: InsightRuleContext) {
    const { event, statistics } = context;
    const goalContext = statistics.context?.goal;
    const insights: InsightCandidate[] = [];

    if (isGoalScoredEvent(event) && event.penalty && goalContext) {
      insights.push({
        type: `${this.id}-converted`,
        phase: InsightPhase.Live,
        scope: InsightScope.Player,
        subjectId: event.playerId,
        matchId: event.matchId,
        dedupeKey: `${this.id}:converted:${event.matchId}:${event.identity.sequenceNumber}`,
        importanceScore:
          goalContext.penaltyGoalsAfter === 1
            ? InsightImportance.High
            : InsightImportance.Medium,
        title:
          goalContext.penaltyGoalsAfter === 1
            ? "Primer penal convertido"
            : "Nuevo gol de penal",
        body: `${goalContext.playerName} suma ${goalContext.penaltyGoalsAfter} gol(es) de penal en Mundiales.`,
        facts: {
          playerId: event.playerId,
          penaltyGoalsBefore: goalContext.penaltyGoalsBefore,
          penaltyGoalsAfter: goalContext.penaltyGoalsAfter,
          penaltyMissesBefore: goalContext.penaltyMissesBefore,
        },
      });
    }

    if (
      event.kind === LiveEventKind.PenaltyMissed &&
      event.playerId &&
      event.teamId
    ) {
      insights.push({
        type: `${this.id}-missed`,
        phase: InsightPhase.Live,
        scope: InsightScope.Player,
        subjectId: event.playerId,
        matchId: event.matchId,
        dedupeKey: `${this.id}:missed:${event.matchId}:${event.identity.sequenceNumber}`,
        importanceScore: InsightImportance.High,
        title: "Penal fallado",
        body: `${payloadPlayerName(event.payload)} fallo un penal en Mundial.`,
        facts: {
          playerId: event.playerId,
          teamId: event.teamId,
          opponentId: event.opponentId,
          minute: event.minute,
        },
      });
    }

    return insights;
  }
}

function payloadPlayerName(payload: Record<string, unknown>) {
  const player =
    typeof payload.player === "object" && payload.player !== null
      ? (payload.player as Record<string, unknown>)
      : {};
  return typeof player.name === "string" && player.name.trim()
    ? player.name
    : "El ejecutante";
}
