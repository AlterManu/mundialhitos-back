import path from "path";
import { DataSource } from "typeorm";
import { Card } from "@/entities/Card";
import { Goal } from "@/entities/Goal";
import { GroupStanding } from "@/entities/GroupStanding";
import { Match } from "@/entities/Match";
import { PenaltyKick } from "@/entities/PenaltyKick";
import { Player } from "@/entities/Player";
import { PlayerAppearance } from "@/entities/PlayerAppearance";
import { SquadMember } from "@/entities/SquadMember";
import { Substitution } from "@/entities/Substitution";
import { Team } from "@/entities/Team";
import { TeamAppearance } from "@/entities/TeamAppearance";
import { TournamentStage } from "@/entities/TournamentStage";
import { TournamentStanding } from "@/entities/TournamentStanding";
import { WorldCup } from "@/entities/WorldCup";
import { CsvDatasetReader } from "@/infrastructure/datasets/CsvDatasetReader";
import { RebuildStatisticsService } from "@/application/statistics/RebuildStatisticsService";

export interface HistoricalImportResult {
  worldCups: number;
  tournamentStages: number;
  teams: number;
  players: number;
  matches: number;
  goals: number;
  cards: number;
  substitutions: number;
  penaltyKicks: number;
  squadMembers: number;
  playerAppearances: number;
  teamAppearances: number;
  groupStandings: number;
  tournamentStandings: number;
}

export class HistoricalDatasetsImportService {
  private readonly datasetsReader: CsvDatasetReader;
  private readonly seedReader: CsvDatasetReader;

  constructor(private readonly dataSource: DataSource) {
    const projectRoot = path.resolve(__dirname, "../../..");
    this.datasetsReader = new CsvDatasetReader(path.join(projectRoot, "datasets"));
    this.seedReader = new CsvDatasetReader(path.join(projectRoot, "src", "seeds"));
  }

  async importAll(): Promise<HistoricalImportResult> {
    await this.clearHistoricalTables();

    const result: HistoricalImportResult = {
      worldCups: await this.importWorldCups(),
      tournamentStages: await this.importTournamentStages(),
      teams: await this.importTeams(),
      players: await this.importPlayers(),
      matches: await this.importMatches(),
      goals: await this.importGoals(),
      cards: await this.importCards(),
      substitutions: await this.importSubstitutions(),
      penaltyKicks: await this.importPenaltyKicks(),
      squadMembers: await this.importSquadMembers(),
      playerAppearances: await this.importPlayerAppearances(),
      teamAppearances: await this.importTeamAppearances(),
      groupStandings: await this.importGroupStandings(),
      tournamentStandings: await this.importTournamentStandings(),
    };

    await new RebuildStatisticsService(this.dataSource).rebuild();

    return result;
  }

  private async clearHistoricalTables() {
    await this.dataSource.getRepository(TournamentStanding).clear();
    await this.dataSource.getRepository(GroupStanding).clear();
    await this.dataSource.getRepository(TeamAppearance).clear();
    await this.dataSource.getRepository(PlayerAppearance).clear();
    await this.dataSource.getRepository(SquadMember).clear();
    await this.dataSource.getRepository(PenaltyKick).clear();
    await this.dataSource.getRepository(Substitution).clear();
    await this.dataSource.getRepository(Card).clear();
    await this.dataSource.getRepository(Goal).clear();
    await this.dataSource.getRepository(Match).clear();
    await this.dataSource.getRepository(Player).clear();
    await this.dataSource.getRepository(Team).clear();
    await this.dataSource.getRepository(TournamentStage).clear();
    await this.dataSource.getRepository(WorldCup).clear();
  }

  private async importWorldCups() {
    const repo = this.dataSource.getRepository(WorldCup);
    const rows = this.datasetsReader.readRows("tournaments.csv");
    const entities = rows.map((row) =>
      repo.create({
        tournament_id: text(row, "tournament_id"),
        name: text(row, "tournament_name"),
        year: number(row, "year"),
        start_date: date(row, "start_date"),
        end_date: date(row, "end_date"),
        host_country: nullableText(row, "host_country"),
        winner_team_id: null,
        count_teams: number(row, "count_teams"),
      }),
    );
    await repo.save(entities);
    return entities.length;
  }

  private async importTournamentStages() {
    const repo = this.dataSource.getRepository(TournamentStage);
    const rows = this.datasetsReader.readRows("tournament_stages.csv");
    const entities = rows.map((row) =>
      repo.create({
        tournament_id: text(row, "tournament_id"),
        stage_number: number(row, "stage_number"),
        stage_name: text(row, "stage_name"),
        group_stage: bool(row, "group_stage"),
        knockout_stage: bool(row, "knockout_stage"),
        start_date: date(row, "start_date"),
        end_date: date(row, "end_date"),
      }),
    );
    await repo.save(entities);
    return entities.length;
  }

  private async importTeams() {
    const repo = this.dataSource.getRepository(Team);
    const rows = this.datasetsReader.readRows("teams (solo paises).csv");
    const entities = rows.map((row) =>
      repo.create({
        team_id: text(row, "team_id"),
        name_en: text(row, "name_en"),
        team_code_en: text(row, "team_code_en"),
        confederation_id: text(row, "confederation_id"),
      }),
    );
    await repo.save(entities);
    return entities.length;
  }

  private async importPlayers() {
    const repo = this.dataSource.getRepository(Player);
    const rows = this.seedReader.readRows(path.join("players", "players.csv"));
    const entities = rows.map((row) =>
      repo.create({
        player_id: text(row, "player_id"),
        name: nullableText(row, "name"),
        lastname: nullableText(row, "lastname"),
        birth_date: date(row, "birth_date"),
        goal_keeper: bool(row, "goal_keeper"),
        defender: bool(row, "defender"),
        midfielder: bool(row, "midfielder"),
        forward: bool(row, "forward"),
        count_tournaments: number(row, "count_tournaments"),
        list_tournaments: text(row, "list_tournaments"),
        goals: 0,
        own_goals: 0,
        penalties_scored: 0,
      }),
    );
    await repo.save(entities);
    return entities.length;
  }

  private async importMatches() {
    const repo = this.dataSource.getRepository(Match);
    const rows = this.datasetsReader.readRows("matches.csv");
    const entities = rows.map((row) =>
      repo.create({
        match_id: text(row, "match_id"),
        world_cup_year: number(row, "world_cup_year"),
        stage_name: text(row, "stage_name"),
        group_name: nullableText(row, "group_name"),
        must_be_replayed: bool(row, "must_be_replayed"),
        replay: bool(row, "replay"),
        date: normalizedText(row, "date"),
        time: nullableText(row, "time"),
        stadium_id: text(row, "stadium_id"),
        home_team_id: text(row, "home_team_id"),
        away_team_id: text(row, "away_team_id"),
        home_score: number(row, "home_score"),
        away_score: number(row, "away_score"),
        home_score_margin: nullableNumber(row, "home_score_margin"),
        away_score_margin: nullableNumber(row, "away_score_margin"),
        extra_time: bool(row, "extra_time"),
        penalties: bool(row, "penalties"),
        home_penalty_score: nullableNumber(row, "home_penalty_score"),
        away_penalty_score: nullableNumber(row, "away_penalty_score"),
        winner: winnerId(row),
      }),
    );
    await repo.save(entities);
    return entities.length;
  }

  private async importGoals() {
    const repo = this.dataSource.getRepository(Goal);
    const rows = this.seedReader.readRows(path.join("goals", "goals.csv"));
    const entities = rows.map((row) =>
      repo.create({
        goal_id: text(row, "goal_id"),
        world_cup_year: number(row, "world_cup_year"),
        match_id: text(row, "match_id"),
        team_id: text(row, "team_id"),
        scored_by_player: text(row, "scored_by_player"),
        scored_vs_team: nullableText(row, "scored_vs_team"),
        shirt_number: number(row, "shirt_number"),
        minute: number(row, "minute"),
        additional_minute: number(row, "additional_minute"),
        match_period: text(row, "match_period"),
        own_goal: bool(row, "own_goal"),
        penalty: bool(row, "penalty"),
      }),
    );
    await repo.save(entities);
    return entities.length;
  }

  private async importCards() {
    const repo = this.dataSource.getRepository(Card);
    const rows = this.datasetsReader.readRows("bookings.csv");
    const entities = rows.map((row) =>
      repo.create({
        card_id: text(row, "booking_id"),
        tournament_id: text(row, "tournament_id"),
        match_id: text(row, "match_id"),
        team_id: text(row, "team_id"),
        player_id: text(row, "player_id"),
        minute: number(row, "minute_regulation"),
        additional_minute: number(row, "minute_stoppage"),
        match_period: text(row, "match_period"),
        yellow_card: bool(row, "yellow_card"),
        red_card: bool(row, "red_card"),
        second_yellow_card: bool(row, "second_yellow_card"),
      }),
    );
    await repo.save(entities);
    return entities.length;
  }

  private async importSubstitutions() {
    const repo = this.dataSource.getRepository(Substitution);
    const rows = this.datasetsReader.readRows("substitutions.csv");
    const entities = rows.map((row) =>
      repo.create({
        substitution_id: text(row, "substitution_id"),
        tournament_id: text(row, "tournament_id"),
        match_id: text(row, "match_id"),
        team_id: text(row, "team_id"),
        player_id: text(row, "player_id"),
        minute: number(row, "minute_regulation"),
        additional_minute: number(row, "minute_stoppage"),
        match_period: text(row, "match_period"),
        going_off: bool(row, "going_off"),
        coming_on: bool(row, "coming_on"),
      }),
    );
    await repo.save(entities);
    return entities.length;
  }

  private async importPenaltyKicks() {
    const repo = this.dataSource.getRepository(PenaltyKick);
    const rows = this.datasetsReader.readRows("penalty_kicks.csv");
    const entities = rows.map((row) =>
      repo.create({
        penalty_kick_id: text(row, "penalty_kick_id"),
        tournament_id: text(row, "tournament_id"),
        match_id: text(row, "match_id"),
        team_id: text(row, "team_id"),
        player_id: text(row, "player_id"),
        converted: bool(row, "converted"),
      }),
    );
    await repo.save(entities);
    return entities.length;
  }

  private async importSquadMembers() {
    const repo = this.dataSource.getRepository(SquadMember);
    const rows = this.datasetsReader.readRows("squads (convocados por equipo).csv");
    const entities = rows.map((row) =>
      repo.create({
        world_cup_year: number(row, "world_cup_year"),
        team_id: text(row, "team_id"),
        player_id: text(row, "player_id"),
        shirt_number: nullableNumber(row, "shirt_number"),
        position_name: nullableText(row, "position_name"),
        position_code: nullableText(row, "position_code"),
      }),
    );
    await repo.save(entities);
    return entities.length;
  }

  private async importPlayerAppearances() {
    const repo = this.dataSource.getRepository(PlayerAppearance);
    const rows = this.datasetsReader.readRows("player_appearances.csv");
    const entities = rows.map((row) =>
      repo.create({
        tournament_id: text(row, "tournament_id"),
        match_id: text(row, "match_id"),
        team_id: text(row, "team_id"),
        player_id: text(row, "player_id"),
        shirt_number: nullableNumber(row, "shirt_number"),
        position_name: nullableText(row, "position_name"),
        position_code: nullableText(row, "position_code"),
        starter: bool(row, "starter"),
        substitute: bool(row, "substitute"),
        captain: bool(row, "captain"),
      }),
    );
    await repo.save(entities);
    return entities.length;
  }

  private async importTeamAppearances() {
    const repo = this.dataSource.getRepository(TeamAppearance);
    const rows = this.datasetsReader.readRows("team_appearances.csv");
    const entities = rows.map((row) =>
      repo.create({
        tournament_id: text(row, "tournament_id"),
        match_id: text(row, "match_id"),
        team_id: text(row, "team_id"),
        opponent_id: text(row, "opponent_id"),
        home_team: bool(row, "home_team"),
        away_team: bool(row, "away_team"),
        goals_for: number(row, "goals_for"),
        goals_against: number(row, "goals_against"),
        goal_differential: number(row, "goal_differential"),
        extra_time: bool(row, "extra_time"),
        penalty_shootout: bool(row, "penalty_shootout"),
        win: bool(row, "win"),
        lose: bool(row, "lose"),
        draw: bool(row, "draw"),
      }),
    );
    await repo.save(entities);
    return entities.length;
  }

  private async importGroupStandings() {
    const repo = this.dataSource.getRepository(GroupStanding);
    const rows = this.datasetsReader.readRows("group_standings (posiciones en cada grupo).csv");
    const entities = rows.map((row) =>
      repo.create({
        tournament_id: text(row, "tournament_id"),
        stage_number: number(row, "stage_number"),
        stage_name: text(row, "stage_name"),
        group_name: text(row, "group_name"),
        position: number(row, "position"),
        team_id: text(row, "team_id"),
        played: number(row, "played"),
        wins: number(row, "wins"),
        draws: number(row, "draws"),
        losses: number(row, "losses"),
        goals_for: number(row, "goals_for"),
        goals_against: number(row, "goals_against"),
        goal_difference: number(row, "goal_difference"),
        points: number(row, "points"),
        advanced: bool(row, "advanced"),
      }),
    );
    await repo.save(entities);
    return entities.length;
  }

  private async importTournamentStandings() {
    const repo = this.dataSource.getRepository(TournamentStanding);
    const rows = this.datasetsReader.readRows("tournament_standings.csv");
    const entities = rows.map((row) =>
      repo.create({
        tournament_id: text(row, "tournament_id"),
        position: number(row, "position"),
        team_id: text(row, "team_id"),
      }),
    );
    await repo.save(entities);
    return entities.length;
  }
}

function text(row: Record<string, unknown>, key: string): string {
  return String(row[key] ?? "").trim();
}

function normalizedText(row: Record<string, unknown>, key: string): string {
  return date(row, key) ?? text(row, key);
}

function nullableText(row: Record<string, unknown>, key: string): string | null {
  const value = text(row, key);
  return value.length > 0 && value !== "not applicable" ? value : null;
}

function number(row: Record<string, unknown>, key: string): number {
  const value = Number(row[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function nullableNumber(row: Record<string, unknown>, key: string): number | null {
  const value = row[key];
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function bool(row: Record<string, unknown>, key: string): boolean {
  const value = row[key];
  return value === 1 || value === "1" || value === true || value === "true";
}

function date(row: Record<string, unknown>, key: string): string | null {
  const value = text(row, key);
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const parts = value.split("/");
  if (parts.length !== 3) return null;

  const [day, month, year] = parts;
  if (!day || !month || !year) return null;

  return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function winnerId(row: Record<string, unknown>): string {
  const winner = text(row, "winner");
  if (winner === "home team win") return text(row, "home_team_id");
  if (winner === "away team win") return text(row, "away_team_id");
  return "0";
}
