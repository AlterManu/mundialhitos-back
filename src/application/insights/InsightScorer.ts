import { InsightCandidate } from "@/domain/insights/InsightCandidate";
import { isPublishableImportance } from "@/domain/insights/InsightImportance";

export class InsightScorer {
  filterPublishable(candidates: InsightCandidate[]): InsightCandidate[] {
    return candidates.filter((candidate) =>
      isPublishableImportance(candidate.importanceScore),
    );
  }
}
