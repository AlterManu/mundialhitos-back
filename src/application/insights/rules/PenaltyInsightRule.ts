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

      if (
        goalContext.allTimePenaltyGoalRankAfter !== null &&
        goalContext.allTimePenaltyGoalRankAfter <= 10 &&
        (goalContext.allTimePenaltyGoalRankBefore === null ||
          goalContext.allTimePenaltyGoalRankBefore >
            goalContext.allTimePenaltyGoalRankAfter)
      ) {
        insights.push({
          type: `${this.id}-all-time-penalty-top-10`,
          phase: InsightPhase.Live,
          scope: InsightScope.Player,
          subjectId: event.playerId,
          matchId: event.matchId,
          dedupeKey: `${this.id}:all-time-penalties:${event.playerId}:${goalContext.allTimePenaltyGoalRankAfter}`,
          importanceScore:
            goalContext.allTimePenaltyGoalRankAfter <= 3
              ? InsightImportance.High
              : InsightImportance.Medium,
          title: "Sube entre los especialistas de penal",
          body: `${goalContext.playerName} se coloca en el puesto ${goalContext.allTimePenaltyGoalRankAfter} historico de penales convertidos en Mundiales.`,
          facts: {
            playerId: event.playerId,
            rankBefore: goalContext.allTimePenaltyGoalRankBefore,
            rankAfter: goalContext.allTimePenaltyGoalRankAfter,
            penaltiesScored: goalContext.penaltyGoalsAfter,
          },
        });
      }

      if (
        goalContext.nationalPenaltyGoalRankAfter !== null &&
        goalContext.nationalPenaltyGoalRankAfter <= 10 &&
        (goalContext.nationalPenaltyGoalRankBefore === null ||
          goalContext.nationalPenaltyGoalRankBefore >
            goalContext.nationalPenaltyGoalRankAfter)
      ) {
        insights.push({
          type: `${this.id}-national-penalty-top-10`,
          phase: InsightPhase.Live,
          scope: InsightScope.Player,
          subjectId: event.playerId,
          matchId: event.matchId,
          dedupeKey: `${this.id}:national-penalties:${event.teamId}:${event.playerId}:${goalContext.nationalPenaltyGoalRankAfter}`,
          importanceScore:
            goalContext.nationalPenaltyGoalRankAfter <= 3
              ? InsightImportance.High
              : InsightImportance.Medium,
          title: "Sube entre los penaleros de su seleccion",
          body: `${goalContext.playerName} se coloca en el puesto ${goalContext.nationalPenaltyGoalRankAfter} de penales convertidos mundialistas de ${goalContext.teamName}.`,
          facts: {
            playerId: event.playerId,
            teamId: event.teamId,
            rankBefore: goalContext.nationalPenaltyGoalRankBefore,
            rankAfter: goalContext.nationalPenaltyGoalRankAfter,
            penaltiesScored: goalContext.penaltyGoalsAfter,
          },
        });
      }
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
