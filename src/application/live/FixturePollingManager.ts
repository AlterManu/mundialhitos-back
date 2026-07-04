import { DataSource, Repository } from "typeorm";
import { ApiFootballClient } from "@/infrastructure/apiFootball/ApiFootballClient";
import { ApiFootballFixture } from "@/entities/ApiFootballFixture";
import {
  FixturePollingState,
  PollingStatus,
} from "@/entities/FixturePollingState";
import { ApiFootballLiveSyncService } from "./ApiFootballLiveSyncService";

export interface StartPollingOptions {
  intervalSeconds?: number;
}

export class FixturePollingManager {
  private readonly fixtureRepo: Repository<ApiFootballFixture>;
  private readonly pollingRepo: Repository<FixturePollingState>;
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly dataSource: DataSource,
    private readonly apiClient: ApiFootballClient,
  ) {
    this.fixtureRepo = dataSource.getRepository(ApiFootballFixture);
    this.pollingRepo = dataSource.getRepository(FixturePollingState);
  }

  async start(matchId: string, options: StartPollingOptions = {}) {
    const fixture = await this.getFixture(matchId);
    const intervalSeconds = clampInterval(options.intervalSeconds ?? 60);
    const state = await this.upsertState(fixture, {
      status: PollingStatus.Running,
      intervalSeconds,
      lastError: null,
      nextPollAt: new Date(Date.now() + intervalSeconds * 1000),
    });

    this.stopTimer(matchId);
    const timer = setInterval(() => {
      void this.pollOnce(matchId);
    }, intervalSeconds * 1000);
    this.timers.set(matchId, timer);

    await this.pollOnce(matchId);
    return state;
  }

  async stop(matchId: string) {
    this.stopTimer(matchId);
    const state = await this.pollingRepo.findOneBy({ internal_match_id: matchId });
    if (!state) return null;

    state.status = PollingStatus.Stopped;
    state.next_poll_at = null;
    return this.pollingRepo.save(state);
  }

  async status(matchId?: string) {
    if (matchId) {
      return this.pollingRepo.findOneBy({ internal_match_id: matchId });
    }

    return this.pollingRepo.find({ order: { updated_at: "DESC" } });
  }

  private async pollOnce(matchId: string) {
    const fixture = await this.getFixture(matchId);
    const state = await this.upsertState(fixture, {
      status: PollingStatus.Running,
      lastError: null,
      lastPolledAt: new Date(),
      nextPollAt: null,
    });

    try {
      const syncService = new ApiFootballLiveSyncService(
        this.dataSource,
        this.apiClient,
      );
      await syncService.syncFixture(Number(fixture.api_fixture_id));

      const refreshedFixture = await this.getFixture(matchId);
      state.last_polled_at = new Date();
      state.last_error = null;

      if (isFinishedStatus(refreshedFixture.status_short)) {
        state.status = PollingStatus.Stopped;
        state.next_poll_at = null;
        this.stopTimer(matchId);
      } else {
        state.status = PollingStatus.Running;
        state.next_poll_at = new Date(
          Date.now() + state.interval_seconds * 1000,
        );
      }

      await this.pollingRepo.save(state);
    } catch (error) {
      state.status = PollingStatus.Failed;
      state.last_error =
        error instanceof Error ? error.message : "Unknown polling error";
      state.next_poll_at = null;
      this.stopTimer(matchId);
      await this.pollingRepo.save(state);
    }
  }

  private async getFixture(matchId: string) {
    const fixture = await this.fixtureRepo.findOneBy({
      internal_match_id: matchId,
    });
    if (!fixture) {
      throw new Error(`Fixture ${matchId} not found`);
    }
    return fixture;
  }

  private async upsertState(
    fixture: ApiFootballFixture,
    values: {
      status: PollingStatus;
      intervalSeconds?: number;
      lastError?: string | null;
      lastPolledAt?: Date | null;
      nextPollAt?: Date | null;
    },
  ) {
    const state =
      (await this.pollingRepo.findOneBy({
        internal_match_id: fixture.internal_match_id,
      })) ??
      this.pollingRepo.create({
        internal_match_id: fixture.internal_match_id,
        api_fixture_id: fixture.api_fixture_id,
      });

    state.status = values.status;
    state.api_fixture_id = fixture.api_fixture_id;
    if (values.intervalSeconds) state.interval_seconds = values.intervalSeconds;
    if ("lastError" in values) state.last_error = values.lastError ?? null;
    if ("lastPolledAt" in values) {
      state.last_polled_at = values.lastPolledAt ?? null;
    }
    if ("nextPollAt" in values) {
      state.next_poll_at = values.nextPollAt ?? null;
    }

    return this.pollingRepo.save(state);
  }

  private stopTimer(matchId: string) {
    const timer = this.timers.get(matchId);
    if (!timer) return;

    clearInterval(timer);
    this.timers.delete(matchId);
  }
}

function clampInterval(intervalSeconds: number): number {
  if (!Number.isFinite(intervalSeconds)) return 60;
  return Math.min(Math.max(Math.round(intervalSeconds), 15), 300);
}

function isFinishedStatus(status: string): boolean {
  return ["FT", "AET", "PEN"].includes(status);
}
