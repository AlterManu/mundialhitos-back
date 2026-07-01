import { DataSource, Repository } from "typeorm";
import { InsightCandidate } from "@/domain/insights/InsightCandidate";
import { Insight, InsightStatus } from "@/entities/Insight";

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
      const existing = await this.insightRepo.findOneBy({
        dedupe_key: candidate.dedupeKey,
      });
      if (existing) continue;

      const insight = this.insightRepo.create({
        type: candidate.type,
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
}
