import { DataSource, Repository } from "typeorm";
import { Assist } from "@/entities/Assist";
import { Card } from "@/entities/Card";
import { ExternalIdMapping, ExternalProvider, MappedEntityType } from "@/entities/ExternalIdMapping";
import { Goal } from "@/entities/Goal";
import { Match } from "@/entities/Match";
import { PenaltyKick } from "@/entities/PenaltyKick";
import { PlayerAppearance } from "@/entities/PlayerAppearance";
import { Substitution } from "@/entities/Substitution";
import {
  ApiFootballFixtureDto,
  ApiFootballFixtureEventDto,
  ApiFootballLineupPlayerDto,
} from "@/infrastructure/apiFootball/ApiFootballTypes";
import { buildInternalMatchId } from "./ApiFootballFixtureStore";

export interface ApiFootballHistoricalMaterializationResult {
  materializedMatches: number;
  goals: number;
  assists: number;
  cards: number;
  substitutions: number;
  penaltyKicks: number;
  playerAppearances: number;
  skippedUnresolvedEvents: number;
}

interface LocalFixtureIds {
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  venueId: string;
}

export class ApiFootballHistoricalMaterializer {
  private readonly mappingRepo: Repository<ExternalIdMapping>;
  private readonly matchRepo: Repository<Match>;
  private readonly goalRepo: Repository<Goal>;
  private readonly assistRepo: Repository<Assist>;
  private readonly cardRepo: Repository<Card>;
  private readonly substitutionRepo: Repository<Substitution>;
  private readonly penaltyKickRepo: Repository<PenaltyKick>;
  private readonly appearanceRepo: Repository<PlayerAppearance>;

  constructor(private readonly dataSource: DataSource) {
    this.mappingRepo = dataSource.getRepository(ExternalIdMapping);
    this.matchRepo = dataSource.getRepository(Match);
    this.goalRepo = dataSource.getRepository(Goal);
    this.assistRepo = dataSource.getRepository(Assist);
    this.cardRepo = dataSource.getRepository(Card);
    this.substitutionRepo = dataSource.getRepository(Substitution);
    this.penaltyKickRepo = dataSource.getRepository(PenaltyKick);
    this.appearanceRepo = dataSource.getRepository(PlayerAppearance);
  }

  async materialize(
    fixture: ApiFootballFixtureDto,
  ): Promise<ApiFootballHistoricalMaterializationResult> {
    const empty = {
      materializedMatches: 0,
      goals: 0,
      assists: 0,
      cards: 0,
      substitutions: 0,
      penaltyKicks: 0,
      playerAppearances: 0,
      skippedUnresolvedEvents: 0,
    };

    if (!isFinishedStatus(fixture.fixture.status.short)) return empty;
    if (fixture.goals.home === null || fixture.goals.away === null) return empty;

    const ids = await this.resolveFixtureIds(fixture);
    if (!ids) return { ...empty, skippedUnresolvedEvents: 1 };

    await this.clearMaterializedMatch(ids.matchId);
    await this.matchRepo.save(this.toMatch(fixture, ids));

    const appearances = await this.materializeLineups(fixture, ids);
    const events = await this.materializeEvents(fixture, ids);

    return {
      materializedMatches: 1,
      goals: events.goals,
      assists: events.assists,
      cards: events.cards,
      substitutions: events.substitutions,
      penaltyKicks: events.penaltyKicks,
      playerAppearances: appearances + events.playerAppearances,
      skippedUnresolvedEvents: events.skippedUnresolvedEvents,
    };
  }

  private async clearMaterializedMatch(matchId: string) {
    await this.goalRepo.delete({ match_id: matchId });
    await this.assistRepo.delete({ match_id: matchId });
    await this.cardRepo.delete({ match_id: matchId });
    await this.substitutionRepo.delete({ match_id: matchId });
    await this.penaltyKickRepo.delete({ match_id: matchId });
    await this.appearanceRepo.delete({ match_id: matchId });
  }

  private async resolveFixtureIds(
    fixture: ApiFootballFixtureDto,
  ): Promise<LocalFixtureIds | null> {
    const homeTeamId = await this.resolve(MappedEntityType.Team, fixture.teams.home.id);
    const awayTeamId = await this.resolve(MappedEntityType.Team, fixture.teams.away.id);
    if (!homeTeamId || !awayTeamId) return null;

    const venueId =
      fixture.fixture.venue.id !== null
        ? await this.resolve(MappedEntityType.Venue, fixture.fixture.venue.id)
        : null;

    return {
      matchId: buildInternalMatchId(fixture),
      homeTeamId,
      awayTeamId,
      venueId: venueId ?? "unknown",
    };
  }

  private toMatch(fixture: ApiFootballFixtureDto, ids: LocalFixtureIds) {
    const homeScore = fixture.goals.home ?? 0;
    const awayScore = fixture.goals.away ?? 0;
    const penalty = fixture.score?.penalty;
    const homePenaltyScore = penalty?.home ?? null;
    const awayPenaltyScore = penalty?.away ?? null;

    return this.matchRepo.create({
      match_id: ids.matchId,
      world_cup_year: fixture.league.season,
      stage_name: fixture.league.round ?? "Unknown",
      group_name: groupName(fixture.league.round),
      date: fixture.fixture.date.slice(0, 10),
      time: fixture.fixture.date.slice(11, 16),
      stadium_id: ids.venueId,
      home_team_id: ids.homeTeamId,
      away_team_id: ids.awayTeamId,
      home_score: homeScore,
      away_score: awayScore,
      home_score_margin: homeScore - awayScore,
      away_score_margin: awayScore - homeScore,
      extra_time: ["AET", "PEN"].includes(fixture.fixture.status.short),
      penalties: fixture.fixture.status.short === "PEN",
      home_penalty_score: homePenaltyScore,
      away_penalty_score: awayPenaltyScore,
      winner: winner(fixture, ids, homeScore, awayScore, homePenaltyScore, awayPenaltyScore),
    });
  }

  private async materializeLineups(
    fixture: ApiFootballFixtureDto,
    ids: LocalFixtureIds,
  ) {
    let saved = 0;

    for (const lineup of fixture.lineups ?? []) {
      const teamId = await this.resolve(MappedEntityType.Team, lineup.team.id);
      if (!teamId) continue;

      for (const player of lineup.startXI ?? []) {
        if (await this.saveAppearance(fixture, ids.matchId, teamId, player, true)) {
          saved += 1;
        }
      }
    }

    return saved;
  }

  private async materializeEvents(
    fixture: ApiFootballFixtureDto,
    ids: LocalFixtureIds,
  ) {
    const result = {
      goals: 0,
      assists: 0,
      cards: 0,
      substitutions: 0,
      penaltyKicks: 0,
      playerAppearances: 0,
      skippedUnresolvedEvents: 0,
    };

    for (const [index, event] of (fixture.events ?? []).entries()) {
      const teamId = await this.resolve(MappedEntityType.Team, event.team.id);
      const playerId = await this.resolve(MappedEntityType.Player, event.player.id);
      const opponentId =
        teamId === ids.homeTeamId ? ids.awayTeamId : teamId === ids.awayTeamId ? ids.homeTeamId : null;

      if (!teamId || !playerId) {
        result.skippedUnresolvedEvents += 1;
        continue;
      }

      if (isPenaltyKick(event)) {
        await this.penaltyKickRepo.save(
          this.penaltyKickRepo.create({
            penalty_kick_id: `AF-${fixture.fixture.id}-PK-${index}`,
            tournament_id: String(fixture.league.season),
            match_id: ids.matchId,
            team_id: teamId,
            player_id: playerId,
            converted: event.detail !== "Missed Penalty",
          }),
        );
        result.penaltyKicks += 1;
      }

      if (event.type === "Goal" && event.comments !== "Penalty Shootout" && event.detail !== "Missed Penalty") {
        const goalId = `AF-${fixture.fixture.id}-G-${index}`;
        await this.goalRepo.save(
          this.goalRepo.create({
            goal_id: goalId,
            world_cup_year: fixture.league.season,
            match_id: ids.matchId,
            team_id: teamId,
            scored_by_player: playerId,
            scored_vs_team: opponentId,
            shirt_number: 0,
            minute: event.time.elapsed ?? 0,
            additional_minute: event.time.extra ?? 0,
            match_period: matchPeriod(event),
            own_goal: event.detail?.toLowerCase().includes("own goal") ?? false,
            penalty: event.detail?.toLowerCase().includes("penalty") ?? false,
          }),
        );
        result.goals += 1;

        const assistPlayerId = await this.resolve(
          MappedEntityType.Player,
          event.assist.id,
        );
        const isOwnGoal = event.detail?.toLowerCase().includes("own goal") ?? false;
        if (assistPlayerId && !isOwnGoal) {
          await this.assistRepo.save(
            this.assistRepo.create({
              assist_id: `AF-${fixture.fixture.id}-A-${index}`,
              tournament_id: String(fixture.league.season),
              match_id: ids.matchId,
              team_id: teamId,
              player_id: assistPlayerId,
              goal_id: goalId,
            }),
          );
          result.assists += 1;
        }
      }

      if (event.type === "Card") {
        await this.cardRepo.save(
          this.cardRepo.create({
            card_id: `AF-${fixture.fixture.id}-C-${index}`,
            tournament_id: String(fixture.league.season),
            match_id: ids.matchId,
            team_id: teamId,
            player_id: playerId,
            minute: event.time.elapsed ?? 0,
            additional_minute: event.time.extra ?? 0,
            match_period: matchPeriod(event),
            yellow_card: event.detail === "Yellow Card",
            red_card: event.detail === "Red Card",
            second_yellow_card: event.detail === "Second Yellow Card",
          }),
        );
        result.cards += 1;
      }

      if (event.type === "subst") {
        result.substitutions += await this.saveSubstitution(fixture, ids.matchId, teamId, event, index);
        result.playerAppearances += await this.saveSubstituteAppearance(fixture, ids.matchId, teamId, event);
      }
    }

    return result;
  }

  private async saveSubstitution(
    fixture: ApiFootballFixtureDto,
    matchId: string,
    teamId: string,
    event: ApiFootballFixtureEventDto,
    index: number,
  ) {
    const offPlayerId = await this.resolve(MappedEntityType.Player, event.player.id);
    const onPlayerId = await this.resolve(MappedEntityType.Player, event.assist.id);
    let saved = 0;

    if (offPlayerId) {
      await this.substitutionRepo.save(
        this.substitutionRepo.create({
          substitution_id: `AF-${fixture.fixture.id}-S-${index}-OFF`,
          tournament_id: String(fixture.league.season),
          match_id: matchId,
          team_id: teamId,
          player_id: offPlayerId,
          minute: event.time.elapsed ?? 0,
          additional_minute: event.time.extra ?? 0,
          match_period: matchPeriod(event),
          going_off: true,
          coming_on: false,
        }),
      );
      saved += 1;
    }

    if (onPlayerId) {
      await this.substitutionRepo.save(
        this.substitutionRepo.create({
          substitution_id: `AF-${fixture.fixture.id}-S-${index}-ON`,
          tournament_id: String(fixture.league.season),
          match_id: matchId,
          team_id: teamId,
          player_id: onPlayerId,
          minute: event.time.elapsed ?? 0,
          additional_minute: event.time.extra ?? 0,
          match_period: matchPeriod(event),
          going_off: false,
          coming_on: true,
        }),
      );
      saved += 1;
    }

    return saved;
  }

  private async saveSubstituteAppearance(
    fixture: ApiFootballFixtureDto,
    matchId: string,
    teamId: string,
    event: ApiFootballFixtureEventDto,
  ) {
    const playerId = await this.resolve(MappedEntityType.Player, event.assist.id);
    if (!playerId) return 0;

    await this.appearanceRepo.save(
      this.appearanceRepo.create({
        tournament_id: String(fixture.league.season),
        match_id: matchId,
        team_id: teamId,
        player_id: playerId,
        shirt_number: null,
        position_code: null,
        position_name: null,
        starter: false,
        substitute: true,
      }),
    );

    return 1;
  }

  private async saveAppearance(
    fixture: ApiFootballFixtureDto,
    matchId: string,
    teamId: string,
    lineupPlayer: ApiFootballLineupPlayerDto,
    starter: boolean,
  ) {
    const playerId = await this.resolve(MappedEntityType.Player, lineupPlayer.player.id);
    if (!playerId) return false;

    await this.appearanceRepo.save(
      this.appearanceRepo.create({
        tournament_id: String(fixture.league.season),
        match_id: matchId,
        team_id: teamId,
        player_id: playerId,
        shirt_number: lineupPlayer.player.number,
        position_code: lineupPlayer.player.pos,
        position_name: positionName(lineupPlayer.player.pos),
        starter,
        substitute: !starter,
      }),
    );
    return true;
  }

  private async resolve(entityType: MappedEntityType, externalId: number | string | null) {
    if (externalId === null) return null;
    const mapping = await this.mappingRepo.findOneBy({
      provider: ExternalProvider.ApiFootball,
      entity_type: entityType,
      external_id: String(externalId),
    });
    return mapping?.local_id ?? null;
  }
}

function isFinishedStatus(status: string) {
  return ["FT", "AET", "PEN"].includes(status);
}

function groupName(round: string | null) {
  if (!round?.toLowerCase().includes("group")) return null;
  return round.includes("-") ? round.split("-").at(-1)?.trim() ?? null : round;
}

function winner(
  fixture: ApiFootballFixtureDto,
  ids: LocalFixtureIds,
  homeScore: number,
  awayScore: number,
  homePenaltyScore: number | null,
  awayPenaltyScore: number | null,
) {
  if (fixture.teams.home.winner === true) return ids.homeTeamId;
  if (fixture.teams.away.winner === true) return ids.awayTeamId;
  if (homePenaltyScore !== null && awayPenaltyScore !== null && homePenaltyScore !== awayPenaltyScore) {
    return homePenaltyScore > awayPenaltyScore ? ids.homeTeamId : ids.awayTeamId;
  }
  if (homeScore === awayScore) return "0";
  return homeScore > awayScore ? ids.homeTeamId : ids.awayTeamId;
}

function matchPeriod(event: ApiFootballFixtureEventDto) {
  if (event.comments === "Penalty Shootout") return "penalty_shootout";
  const minute = event.time.elapsed ?? 0;
  if (minute <= 45) return "first_half";
  if (minute <= 90) return "second_half";
  return "extra_time";
}

function isPenaltyKick(event: ApiFootballFixtureEventDto) {
  return (
    event.comments === "Penalty Shootout" ||
    event.detail === "Missed Penalty" ||
    (event.type === "Goal" && event.detail?.toLowerCase().includes("penalty"))
  );
}

function positionName(positionCode: string | null) {
  switch ((positionCode ?? "").toUpperCase()) {
    case "G":
    case "GK":
      return "Goalkeeper";
    case "D":
      return "Defender";
    case "M":
      return "Midfielder";
    case "F":
      return "Forward";
    default:
      return null;
  }
}
