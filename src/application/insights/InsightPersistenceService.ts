import { DataSource, Like, Repository } from "typeorm";
import { InsightCandidate } from "@/domain/insights/InsightCandidate";
import { Insight, InsightPhase, InsightStatus } from "@/entities/Insight";

export class InsightPersistenceService {
  private readonly insightRepo: Repository<Insight>;

  constructor(dataSource: DataSource) {
    this.insightRepo = dataSource.getRepository(Insight);
  }

  async saveCandidates(
    candidates: InsightCandidate[],
    eventLogId: string | null,
  ): Promise<Insight[]> {
    const saved: Insight[] = [];

    for (const candidate of candidates) {
      if (isHatTrickCandidate(candidate)) {
        await this.hideSupersededBraceInsights(candidate);
      }

      const existing = await this.insightRepo.findOneBy({
        dedupe_key: candidate.dedupeKey,
      });
      if (existing) continue;

      const insight = this.insightRepo.create({
        type: candidate.type,
        phase: candidate.phase ?? InsightPhase.Live,
        scope: candidate.scope,
        subject_id: candidate.subjectId,
        match_id: candidate.matchId,
        event_log_id: eventLogId,
        dedupe_key: candidate.dedupeKey,
        importance_score: candidate.importanceScore,
        title: candidate.title,
        body: candidate.body,
        facts: candidate.facts,
        status: InsightStatus.Candidate,
      });
      saved.push(await this.insightRepo.save(insight));
    }

    return saved;
  }

  private async hideSupersededBraceInsights(candidate: InsightCandidate) {
    const braceInsights = await this.insightRepo.find({
      where: {
        match_id: candidate.matchId,
        type: Like("%doblete%"),
      },
    });

    const playerId = candidate.subjectId;
    const superseded = braceInsights.filter((insight) => {
      const factsPlayerId = insight.facts?.playerId;
      return insight.subject_id === playerId || factsPlayerId === playerId;
    });

    for (const insight of superseded) {
      if (!insight.show) continue;
      insight.show = false;
      await this.insightRepo.save(insight);
    }
  }
}

function isHatTrickCandidate(candidate: InsightCandidate) {
  return (
    candidate.type.includes("hat-trick") ||
    candidate.facts.goals === 3
  );
}
