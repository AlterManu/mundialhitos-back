import { InsightImportance } from "@/domain/insights/InsightImportance";
import { InsightRule, InsightRuleContext } from "@/domain/insights/InsightRule";
import { LiveEventKind } from "@/entities/LiveEventLog";
import { InsightPhase, InsightScope } from "@/entities/Insight";

export class PlayerDebutRule implements InsightRule {
  readonly id = "player-world-cup-debut";

  evaluate(context: InsightRuleContext) {
    const debut = context.statistics.context?.substitution;
    if (
      ![LiveEventKind.LineupConfirmed, LiveEventKind.SubstitutionMade].includes(
        context.event.kind,
      ) ||
      !debut?.enteringPlayerId ||
      debut.previousAppearances !== 0
    ) {
      return [];
    }

    return [
      {
        type: this.id,
        phase: InsightPhase.Live,
        scope: InsightScope.Player,
        subjectId: debut.enteringPlayerId,
        matchId: context.event.matchId,
        dedupeKey: `${this.id}:${debut.enteringPlayerId}`,
        importanceScore: InsightImportance.Medium,
        title: "Debut mundialista",
        body: `El jugador ${debut.enteringPlayerId} disputa sus primeros minutos en una Copa del Mundo.`,
        facts: {
          playerId: debut.enteringPlayerId,
          teamId: context.event.teamId,
          minute: context.event.minute,
        },
      },
    ];
  }
}
