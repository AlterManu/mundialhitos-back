import { DataSource, Repository } from "typeorm";
import { LiveEvent } from "@/domain/live/LiveEvent";
import {
  LiveEventLog,
  LiveEventProcessingStatus,
} from "@/entities/LiveEventLog";
import { InsightEngine } from "@/application/insights/InsightEngine";
import { InsightPersistenceService } from "@/application/insights/InsightPersistenceService";
import { StatisticsProjectionUpdater } from "@/application/statistics/StatisticsProjectionUpdater";
import { Insight } from "@/entities/Insight";

export interface LiveEventProcessingResult {
  eventLog: LiveEventLog;
  insights: Insight[];
  alreadyProcessed: boolean;
}

export class LiveEventProcessor {
  private readonly eventRepo: Repository<LiveEventLog>;
  private readonly statsUpdater: StatisticsProjectionUpdater;
  private readonly insightPersistence: InsightPersistenceService;

  constructor(
    dataSource: DataSource,
    private readonly insightEngine = InsightEngine.createDefault(),
  ) {
    this.eventRepo = dataSource.getRepository(LiveEventLog);
    this.statsUpdater = new StatisticsProjectionUpdater(dataSource);
    this.insightPersistence = new InsightPersistenceService(dataSource);
  }

  async process(event: LiveEvent): Promise<LiveEventProcessingResult> {
    const existing = await this.eventRepo.findOneBy({
      provider: event.identity.provider,
      provider_event_id: event.identity.providerEventId,
    });

    if (existing?.status === LiveEventProcessingStatus.Processed) {
      return { eventLog: existing, insights: [], alreadyProcessed: true };
    }

    const eventLog =
      existing ??
      this.eventRepo.create({
        provider: event.identity.provider,
        provider_event_id: event.identity.providerEventId,
        kind: event.kind,
        match_id: event.matchId,
        team_id: event.teamId,
        player_id: event.playerId,
        opponent_id: event.opponentId,
        minute: event.minute,
        additional_minute: event.additionalMinute,
        sequence_number: event.identity.sequenceNumber,
        payload: event.payload,
        status: LiveEventProcessingStatus.Pending,
      });

    await this.eventRepo.save(eventLog);

    try {
      const statistics = await this.statsUpdater.apply(event);
      const candidates = this.insightEngine.evaluate(event, statistics);
      const insights = await this.insightPersistence.saveCandidates(
        candidates,
        eventLog.id,
      );

      eventLog.status = LiveEventProcessingStatus.Processed;
      eventLog.error_message = null;
      await this.eventRepo.save(eventLog);

      return { eventLog, insights, alreadyProcessed: false };
    } catch (error) {
      eventLog.status = LiveEventProcessingStatus.Failed;
      eventLog.error_message =
        error instanceof Error ? error.message : "Unknown processing error";
      await this.eventRepo.save(eventLog);
      throw error;
    }
  }
}
