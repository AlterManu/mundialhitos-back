import { AppDataSource } from "@/config/dataSource";
import { Goal } from "@/entities/Goal";
import { Match, MatchEvent, MatchEventType } from "@/models/common.model";

// async function saveGoalToDatabase(goal: Goal) {
//   const { time, team, player, assist, type, detail, comments } = event;
//    const goal = repo.create({
//       goal_id: event.goal_id,
//       world_cup_year: event.world_cup_year,
//       match_id: event.match_id,
//       team_id: event.team.id,
//       scored_by_player: event.scored_by_player,
//       shirt_number: event.shirt_number,
//       minute: event.minute,
//       additional_minute: event.additional_minute,
//       match_period: event.match_period,
//       own_goal: event.own_goal,
//       penalty: event.penalty,
//     });
//     await repo.save(goal);
// }

// prettier-ignore
const isFirstGoalAgainstTeam = async (playerId: string, versusTeam: string, goals: Goal[]) => { 
  const goalsAgainstTeam = goals.filter((goal) => (goal.scored_by_player === playerId && goal.scored_vs_team === versusTeam));

  if (goalsAgainstTeam.length === 0) {
    console.log(`Player ${playerId} scored his first goal against team ${versusTeam}`);
  }
};

async function processGoal(match: Match, event: MatchEvent) {
  const goalRepo = AppDataSource.getRepository(Goal);
  const goals = await goalRepo.find();

  // 2. Procesar el evento para saber si es un hito
  const homeTeam = match.teams.home;
  const awayTeam = match.teams.away;

  const playerId = event.player.id;
  const playerTeam = event.team.id;
  const versusTeam = playerTeam === homeTeam.id ? awayTeam.id : homeTeam.id;

  // isFirstGoalInWorldCups(match, player);
  isFirstGoalAgainstTeam(playerId, versusTeam, goals);
  // saveGoalToDatabase()
}

// Procesa todos los eventos de a 1 a la vez
async function processEvents(match: Match, events: MatchEvent[]) {
  await AppDataSource.initialize();

  // 1. Proceso el evento para saber si es un hito
  for (const event of events) {
    if (event.type === MatchEventType.Goal) {
      await processGoal(match, event);
    }
  }

  // 2. Por último, guardo el evento en la base de datos
}

export default processEvents;
