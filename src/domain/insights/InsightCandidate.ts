import { InsightPhase, InsightScope } from "@/entities/Insight";

export interface InsightCandidate {
  type: string;
  phase?: InsightPhase;
  scope: InsightScope;
  subjectId: string;
  matchId: string;
  dedupeKey: string;
  importanceScore: number;
  title: string;
  body: string;
  facts: Record<string, unknown>;
}
