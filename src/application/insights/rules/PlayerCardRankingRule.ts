import { InsightCandidate } from "@/domain/insights/InsightCandidate";
import { InsightImportance } from "@/domain/insights/InsightImportance";
import { InsightRule, InsightRuleContext } from "@/domain/insights/InsightRule";
import { InsightPhase, InsightScope } from "@/entities/Insight";
import { LiveEventKind } from "@/entities/LiveEventLog";

export class PlayerCardRankingRule implements InsightRule {
  readonly id = "player-card-ranking";

  evaluate(context: InsightRuleContext) {
    const { event, statistics } = context;
    const cardContext = statistics.context?.card;
    if (event.kind !== LiveEventKind.CardShown || !event.playerId || !cardContext) {
      return [];
    }

    const insights: InsightCandidate[] = [];
    for (const ranking of cardContext.rankings) {
      if (
        ranking.allTimeRankAfter !== null &&
        ranking.allTimeRankAfter <= 10 &&
        (ranking.allTimeRankBefore === null ||
          ranking.allTimeRankBefore > ranking.allTimeRankAfter)
      ) {
        insights.push({
          type: `${this.id}-all-time-top-10-${ranking.metric}`,
          phase: InsightPhase.Live,
          scope: InsightScope.Player,
          subjectId: event.playerId,
          matchId: event.matchId,
          dedupeKey: `${this.id}:all-time:${ranking.metric}:${event.playerId}:${ranking.allTimeRankAfter}`,
          importanceScore:
            ranking.allTimeRankAfter <= 3
              ? InsightImportance.High
              : InsightImportance.Medium,
          title: "Sube en el ranking disciplinario",
          body: `${cardContext.playerName} se coloca en el puesto ${ranking.allTimeRankAfter} historico de ${ranking.label} en Mundiales.`,
          facts: {
            playerId: event.playerId,
            metric: ranking.metric,
            rankBefore: ranking.allTimeRankBefore,
            rankAfter: ranking.allTimeRankAfter,
            total: ranking.totalAfter,
          },
        });
      }

      if (
        ranking.nationalRankAfter !== null &&
        ranking.nationalRankAfter <= 10 &&
        (ranking.nationalRankBefore === null ||
          ranking.nationalRankBefore > ranking.nationalRankAfter)
      ) {
        insights.push({
          type: `${this.id}-national-top-10-${ranking.metric}`,
          phase: InsightPhase.Live,
          scope: InsightScope.Player,
          subjectId: event.playerId,
          matchId: event.matchId,
          dedupeKey: `${this.id}:national:${ranking.metric}:${event.teamId}:${event.playerId}:${ranking.nationalRankAfter}`,
          importanceScore:
            ranking.nationalRankAfter <= 3
              ? InsightImportance.High
              : InsightImportance.Medium,
          title: "Sube en disciplina dentro de su seleccion",
          body: `${cardContext.playerName} se coloca en el puesto ${ranking.nationalRankAfter} de ${ranking.label} mundialistas de ${cardContext.teamName}.`,
          facts: {
            playerId: event.playerId,
            teamId: event.teamId,
            metric: ranking.metric,
            rankBefore: ranking.nationalRankBefore,
            rankAfter: ranking.nationalRankAfter,
            total: ranking.totalAfter,
          },
        });
      }
    }

    return insights;
  }
}
