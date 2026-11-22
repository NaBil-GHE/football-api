import type { QueryFilter } from 'mongoose';
import { AppError } from '../../utils/app-error';
import {
  buildPaginationMeta,
  parseSortParam,
  type PaginatedResult,
} from '../../utils/pagination';
import { runInTransaction } from '../../utils/transaction';
import { assertValidObjectId } from '../../utils/validation';
import { LeagueModel } from '../leagues/league.model';
import { SeasonModel } from '../leagues/season.model';
import { MatchEventModel } from '../match-events/match-event.model';
import { TeamModel } from '../teams/team.model';
import { assertValidStatusTransition } from './match-lifecycle.service';
import { MatchModel, type MatchDocument } from './match.model';
import {
  generateSimulationSchedule,
  normalizeSimulationConfig,
} from './simulation-engine';
import { stopSimulationWorker } from './match-simulation.service';
import type {
  CreateMatchInput,
  ListMatchesQuery,
  UpdateMatchInput,
} from './match.schema';

const ALLOWED_MATCH_SORT_FIELDS = [
  'kickoff',
  'status',
  'round',
  'createdAt',
] as const;

export const MATCH_POPULATE = [
  { path: 'league', select: 'name country logo type' },
  { path: 'season', select: 'name startDate endDate current' },
  { path: 'homeTeam', select: 'name shortName country logo' },
  { path: 'awayTeam', select: 'name shortName country logo' },
];

async function validateMatchReferences(params: {
  leagueId: string;
  seasonId: string;
  homeTeamId: string;
  awayTeamId: string;
}): Promise<void> {
  if (params.homeTeamId === params.awayTeamId) {
    throw new AppError(
      'Home team and away team must be different',
      400,
      'SAME_TEAM_MATCH',
    );
  }

  const [league, season, homeTeam, awayTeam] = await Promise.all([
    LeagueModel.findById(params.leagueId),
    SeasonModel.findById(params.seasonId),
    TeamModel.findById(params.homeTeamId),
    TeamModel.findById(params.awayTeamId),
  ]);

  if (!league) {
    throw new AppError('League not found', 404, 'LEAGUE_NOT_FOUND');
  }
  if (!season) {
    throw new AppError('Season not found', 404, 'SEASON_NOT_FOUND');
  }
  if (season.league.toString() !== league._id.toString()) {
    throw new AppError(
      'Season does not belong to the specified league',
      400,
      'SEASON_LEAGUE_MISMATCH',
    );
  }
  if (!homeTeam) {
    throw new AppError('Home team not found', 404, 'TEAM_NOT_FOUND');
  }
  if (!awayTeam) {
    throw new AppError('Away team not found', 404, 'TEAM_NOT_FOUND');
  }
}

export async function createMatch(input: CreateMatchInput): Promise<MatchDocument> {
  await validateMatchReferences({
    leagueId: input.league,
    seasonId: input.season,
    homeTeamId: input.homeTeam,
    awayTeamId: input.awayTeam,
  });

  const isSimulation = input.isSimulation ?? false;
  const simulationSeed = isSimulation
    ? (input.simulationSeed ?? `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
    : undefined;
  const simulationConfig = isSimulation
    ? normalizeSimulationConfig(input.simulationConfig)
    : undefined;
  const simulationSchedule =
    isSimulation && simulationSeed
      ? generateSimulationSchedule(simulationSeed, simulationConfig)
      : [];

  const created = await MatchModel.create({
    league: input.league,
    season: input.season,
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
    kickoff: input.kickoff,
    venue: input.venue,
    status: input.status,
    homeScore: input.homeScore,
    awayScore: input.awayScore,
    minute: input.minute,
    round: input.round,
    isSimulation,
    simulationStatus: 'idle',
    simulationSpeed: input.simulationSpeed ?? 10,
    ...(simulationSeed ? { simulationSeed } : {}),
    ...(simulationConfig ? { simulationConfig } : {}),
    simulationSchedule,
  });

  const populated = await MatchModel.findById(created._id).populate(MATCH_POPULATE);
  return populated ?? created;
}

export async function listMatches(
  query: ListMatchesQuery,
  extraFilter: QueryFilter<MatchDocument> = {},
  defaultSort: Record<string, 1 | -1> = { kickoff: 1 },
): Promise<PaginatedResult<MatchDocument>> {
  const filter: QueryFilter<MatchDocument> = { ...extraFilter };

  if (query.league) {
    filter.league = query.league;
  }
  if (query.season) {
    filter.season = query.season;
  }
  if (query.status) {
    filter.status = query.status;
  }
  if (query.round) {
    filter.round = query.round;
  }
  if (query.isSimulation !== undefined) {
    filter.isSimulation = query.isSimulation;
  }
  if (query.team) {
    filter.$or = [{ homeTeam: query.team }, { awayTeam: query.team }];
  }
  if (query.from || query.to) {
    const kickoffFilter: { $gte?: Date; $lte?: Date } = {};
    if (query.from) {
      kickoffFilter.$gte = query.from;
    }
    if (query.to) {
      kickoffFilter.$lte = query.to;
    }
    filter.kickoff = kickoffFilter;
  }

  const sort = parseSortParam(query.sort, ALLOWED_MATCH_SORT_FIELDS, defaultSort);
  const skip = (query.page - 1) * query.limit;

  const [data, total] = await Promise.all([
    MatchModel.find(filter)
      .populate(MATCH_POPULATE)
      .sort(sort)
      .skip(skip)
      .limit(query.limit)
      .exec(),
    MatchModel.countDocuments(filter),
  ]);

  return {
    data,
    pagination: buildPaginationMeta(total, query.page, query.limit),
  };
}

export async function listTodayMatches(
  query: ListMatchesQuery,
): Promise<PaginatedResult<MatchDocument>> {
  const now = new Date();
  const startOfDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
  );
  const endOfDay = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );

  return await listMatches(
    query,
    { kickoff: { $gte: startOfDay, $lte: endOfDay } },
    { kickoff: 1 },
  );
}

export async function listUpcomingMatches(
  query: ListMatchesQuery,
): Promise<PaginatedResult<MatchDocument>> {
  return await listMatches(
    query,
    { status: 'scheduled', kickoff: { $gte: new Date() } },
    { kickoff: 1 },
  );
}

export async function listLiveMatches(
  query: ListMatchesQuery,
): Promise<PaginatedResult<MatchDocument>> {
  return await listMatches(
    query,
    { status: { $in: ['live', 'halftime'] } },
    { kickoff: 1 },
  );
}

export async function listFinishedMatches(
  query: ListMatchesQuery,
): Promise<PaginatedResult<MatchDocument>> {
  return await listMatches(query, { status: 'finished' }, { kickoff: -1 });
}

export async function listTeamMatches(
  teamId: string,
  query: ListMatchesQuery,
): Promise<PaginatedResult<MatchDocument>> {
  assertValidObjectId(teamId, 'team id');

  const team = await TeamModel.findById(teamId);
  if (!team) {
    throw new AppError('Team not found', 404, 'TEAM_NOT_FOUND');
  }

  return await listMatches({ ...query, team: teamId }, {}, { kickoff: -1 });
}

export async function getMatchById(id: string): Promise<MatchDocument> {
  assertValidObjectId(id, 'match id');

  const match = await MatchModel.findById(id).populate(MATCH_POPULATE);
  if (!match) {
    throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
  }

  return match;
}

export async function updateMatch(
  id: string,
  input: UpdateMatchInput,
): Promise<MatchDocument> {
  assertValidObjectId(id, 'match id');

  const existing = await MatchModel.findById(id);
  if (!existing) {
    throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
  }

  const nextLeague = input.league ?? existing.league.toString();
  const nextSeason = input.season ?? existing.season.toString();
  const nextHomeTeam = input.homeTeam ?? existing.homeTeam.toString();
  const nextAwayTeam = input.awayTeam ?? existing.awayTeam.toString();

  if (
    input.league !== undefined ||
    input.season !== undefined ||
    input.homeTeam !== undefined ||
    input.awayTeam !== undefined
  ) {
    await validateMatchReferences({
      leagueId: nextLeague,
      seasonId: nextSeason,
      homeTeamId: nextHomeTeam,
      awayTeamId: nextAwayTeam,
    });
  }

  if (input.status !== undefined) {
    assertValidStatusTransition(existing.status, input.status);
  }

  const updated = await MatchModel.findByIdAndUpdate(
    id,
    { $set: input },
    { returnDocument: 'after', runValidators: true },
  ).populate(MATCH_POPULATE);

  if (!updated) {
    throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
  }

  return updated;
}

export async function deleteMatch(id: string): Promise<MatchDocument> {
  assertValidObjectId(id, 'match id');
  stopSimulationWorker(id);

  return await runInTransaction(async (session) => {
    const matchQuery = MatchModel.findById(id);
    if (session) matchQuery.session(session);
    const match = await matchQuery.exec();

    if (!match) {
      throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
    }

    await MatchEventModel.deleteMany(
      { match: match._id },
      session ? { session } : undefined,
    );
    await MatchModel.deleteOne(
      { _id: match._id },
      session ? { session } : undefined,
    );

    return match;
  });
}
