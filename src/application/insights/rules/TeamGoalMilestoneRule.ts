import { isGoalScoredEvent } from "@/domain/live/LiveEvent";
import { InsightImportance } from "@/domain/insights/InsightImportance";
import { InsightRule, InsightRuleContext } from "@/domain/insights/InsightRule";
import { InsightPhase, InsightScope } from "@/entities/Insight";

const TEAM_GOAL_MILESTONES = new Set([10, 25, 50, 75, 100, 150, 200, 250, 300]);

export class TeamGoalMilestoneRule implements InsightRule {
  readonly id = "team-goal-milestone";

  evaluate(context: InsightRuleContext) {
    const { event, statistics } = context;
    if (!isGoalScoredEvent(event) || !statistics.goal) return [];

    const total = statistics.goal.teamAfter.goals_for;
    if (!TEAM_GOAL_MILESTONES.has(total)) return [];

    return [
      {
        type: this.id,
        phase: InsightPhase.Live,
        scope: InsightScope.Team,
        subjectId: event.teamId,
        matchId: event.matchId,
        dedupeKey: `${this.id}:${event.teamId}:${total}`,
        importanceScore: total >= 100 ? InsightImportance.Historic : InsightImportance.High,
        title: `Gol mundialista número ${total}`,
        body: `${event.teamId} alcanzó ${total} goles en la historia de la Copa del Mundo.`,
        facts: {
          teamId: event.teamId,
          total,
          opponentId: event.opponentId,
        },
      },
    ];
  }
}
