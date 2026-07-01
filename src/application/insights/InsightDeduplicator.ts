import { InsightCandidate } from "@/domain/insights/InsightCandidate";

export class InsightDeduplicator {
  dedupe(candidates: InsightCandidate[]): InsightCandidate[] {
    const seen = new Set<string>();
    return candidates.filter((candidate) => {
      if (seen.has(candidate.dedupeKey)) return false;
      seen.add(candidate.dedupeKey);
      return true;
    });
  }
}
