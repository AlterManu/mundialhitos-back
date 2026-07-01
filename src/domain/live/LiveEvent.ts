import { LiveEventKind } from "@/entities/LiveEventLog";

export interface LiveEventIdentity {
  provider: string;
  providerEventId: string;
  sequenceNumber: number;
}

export interface LiveEvent {
  identity: LiveEventIdentity;
  kind: LiveEventKind;
  matchId: string;
  teamId: string | null;
  opponentId: string | null;
  playerId: string | null;
  assistPlayerId: string | null;
  minute: number | null;
  additionalMinute: number | null;
  occurredAt: string | null;
  detail: string | null;
  payload: Record<string, unknown>;
}

export interface GoalScoredEvent extends LiveEvent {
  kind: LiveEventKind.GoalScored;
  teamId: string;
  opponentId: string;
  playerId: string;
  ownGoal: boolean;
  penalty: boolean;
}

export function isGoalScoredEvent(event: LiveEvent): event is GoalScoredEvent {
  const goalEvent = event as Partial<GoalScoredEvent>;
  return (
    event.kind === LiveEventKind.GoalScored &&
    event.teamId !== null &&
    event.opponentId !== null &&
    event.playerId !== null &&
    typeof goalEvent.ownGoal === "boolean" &&
    typeof goalEvent.penalty === "boolean"
  );
}
