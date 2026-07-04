import fs from "fs";
import { DataSource } from "typeorm";
import { ApiFootballFixtureStore } from "./ApiFootballFixtureStore";
import {
  ApiFootballFixtureDto,
  ApiFootballResponse,
} from "@/infrastructure/apiFootball/ApiFootballTypes";

export class ApiFootballFromFileImportService {
  private readonly store: ApiFootballFixtureStore;

  constructor(dataSource: DataSource) {
    this.store = new ApiFootballFixtureStore(dataSource);
  }

  async importFixtureFile(filePath: string) {
    const payload = this.readFixtureResponse(filePath);
    return this.store.upsertFixtures(payload.response);
  }

  private readFixtureResponse(filePath: string): ApiFootballResponse<ApiFootballFixtureDto> {
    return JSON.parse(
      fs.readFileSync(filePath, "utf8"),
    ) as ApiFootballResponse<ApiFootballFixtureDto>;
  }
}
