import { randomUUID } from "crypto";
import { DataSource } from "typeorm";
import {
  ApiFootballMappingBootstrapOptions,
  ApiFootballMappingBootstrapResult,
  ApiFootballMappingBootstrapService,
} from "@/application/mapping/ApiFootballMappingBootstrapService";
import { ApiFootballClient } from "@/infrastructure/apiFootball/ApiFootballClient";

export type MappingBootstrapJobStatus = "running" | "completed" | "failed";

export interface MappingBootstrapJob {
  id: string;
  status: MappingBootstrapJobStatus;
  options: ApiFootballMappingBootstrapOptions;
  createdAt: string;
  startedAt: string;
  finishedAt: string | null;
  result: ApiFootballMappingBootstrapResult | null;
  error: string | null;
}

export class ApiFootballMappingBootstrapJobManager {
  private readonly jobs = new Map<string, MappingBootstrapJob>();

  constructor(
    private readonly dataSource: DataSource,
    private readonly client: ApiFootballClient,
  ) {}

  start(options: ApiFootballMappingBootstrapOptions): MappingBootstrapJob {
    const now = new Date().toISOString();
    const job: MappingBootstrapJob = {
      id: randomUUID(),
      status: "running",
      options,
      createdAt: now,
      startedAt: now,
      finishedAt: null,
      result: null,
      error: null,
    };

    this.jobs.set(job.id, job);
    void this.run(job);
    return job;
  }

  get(jobId: string): MappingBootstrapJob | null {
    return this.jobs.get(jobId) ?? null;
  }

  list(): MappingBootstrapJob[] {
    return [...this.jobs.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  private async run(job: MappingBootstrapJob) {
    try {
      const service = new ApiFootballMappingBootstrapService(
        this.dataSource,
        this.client,
      );
      job.result = await service.bootstrap(job.options);
      job.status = "completed";
    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : String(error);
    } finally {
      job.finishedAt = new Date().toISOString();
    }
  }
}
