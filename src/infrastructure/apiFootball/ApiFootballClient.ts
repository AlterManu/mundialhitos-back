import {
  ApiFootballFixtureDto,
  ApiFootballResponse,
} from "./ApiFootballTypes";

export interface ApiFootballClientOptions {
  apiKey: string;
  baseUrl?: string;
}

export class ApiFootballClient {
  private readonly baseUrl: string;

  constructor(private readonly options: ApiFootballClientOptions) {
    this.baseUrl = options.baseUrl ?? "https://v3.football.api-sports.io";
  }

  async getFixture(fixtureId: number): Promise<ApiFootballFixtureDto | null> {
    const response = await this.request<ApiFootballFixtureDto>(
      `/fixtures?id=${fixtureId}`,
    );

    return response.response[0] ?? null;
  }

  async getLiveFixtures(leagueId: number, season: number) {
    return this.request<ApiFootballFixtureDto>(
      `/fixtures?live=all&league=${leagueId}&season=${season}`,
    );
  }

  private async request<T>(path: string): Promise<ApiFootballResponse<T>> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        "x-apisports-key": this.options.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(
        `API-Football request failed with ${response.status} ${response.statusText}`,
      );
    }

    return (await response.json()) as ApiFootballResponse<T>;
  }
}
