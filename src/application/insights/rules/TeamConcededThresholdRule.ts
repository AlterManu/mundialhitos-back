import { isGoalScoredEvent } from "@/domain/live/LiveEvent";
import { InsightImportance } from "@/domain/insights/InsightImportance";
import { InsightRule, InsightRuleContext } from "@/domain/insights/InsightRule";
import { InsightPhase, InsightScope } from "@/entities/Insight";

export class TeamConcededThresholdRule implements InsightRule {
  readonly id = "team-conceded-threshold";

  evaluate(context: InsightRuleContext) {
    const { event, statistics } = context;
    const goalContext = statistics.context?.goal;
    if (!isGoalScoredEvent(event) || !goalContext) return [];

    const conceded = goalContext.currentMatchOpponentGoalsAgainstAfter;
    if (![3, 4, 5].includes(conceded)) return [];

    return [
      {
        type: `${this.id}-${conceded}`,
        phase: InsightPhase.Live,
        scope: InsightScope.Team,
        subjectId: event.opponentId,
        matchId: event.matchId,
        dedupeKey: `${this.id}:${event.opponentId}:${event.matchId}:${conceded}`,
        importanceScore:
          conceded >= 5 ? InsightImportance.Historic : InsightImportance.High,
        title: `Le marcan ${conceded} goles`,
        body: `${event.opponentId} ya recibió ${conceded} goles en este partido mundialista.`,
        facts: {
          teamId: event.opponentId,
          conceded,
          scoringTeamId: event.teamId,
        },
      },
    ];
  }
}
