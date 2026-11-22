import type { QueryFilter } from 'mongoose';
import { AppError } from '../../utils/app-error';
import {
  buildPaginationMeta,
  parseSortParam,
  type PaginatedResult,
} from '../../utils/pagination';
import { assertValidObjectId, escapeRegex } from '../../utils/validation';
import { LeagueModel, type LeagueDocument } from './league.model';
import type {
  CreateLeagueInput,
  CreateSeasonInput,
  ListLeaguesQuery,
  UpdateLeagueInput,
  UpdateSeasonInput,
} from './league.schema';
import { SeasonModel, type SeasonDocument } from './season.model';

const ALLOWED_LEAGUE_SORT_FIELDS = ['name', 'country', 'type', 'createdAt'] as const;

export async function createLeague(input: CreateLeagueInput): Promise<LeagueDocument> {
  const existing = await LeagueModel.findOne({
    name: input.name,
    country: input.country,
  }).collation({ locale: 'en', strength: 2 });

  if (existing) {
    throw new AppError(
      `League "${input.name}" already exists in "${input.country}"`,
      409,
      'LEAGUE_ALREADY_EXISTS',
    );
  }

  return await LeagueModel.create(input);
}

export async function listLeagues(
  query: ListLeaguesQuery,
): Promise<PaginatedResult<LeagueDocument>> {
  const filter: QueryFilter<LeagueDocument> = {};

  if (query.country) {
    filter.country = new RegExp(`^${escapeRegex(query.country)}$`, 'i');
  }

  if (query.type) {
    filter.type = query.type;
  }

  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ name: regex }, { country: regex }];
  }

  const sort = parseSortParam(query.sort, ALLOWED_LEAGUE_SORT_FIELDS, { name: 1 });
  const skip = (query.page - 1) * query.limit;

  const [data, total] = await Promise.all([
    LeagueModel.find(filter).sort(sort).skip(skip).limit(query.limit).exec(),
    LeagueModel.countDocuments(filter),
  ]);

  return {
    data,
    pagination: buildPaginationMeta(total, query.page, query.limit),
  };
}

export async function getLeagueById(
  id: string,
): Promise<{ league: LeagueDocument; seasons: SeasonDocument[] }> {
  assertValidObjectId(id, 'league id');

  const league = await LeagueModel.findById(id);
  if (!league) {
    throw new AppError('League not found', 404, 'LEAGUE_NOT_FOUND');
  }

  const seasons = await SeasonModel.find({ league: league._id }).sort({
    startDate: -1,
  });

  return { league, seasons };
}

export async function updateLeague(
  id: string,
  input: UpdateLeagueInput,
): Promise<LeagueDocument> {
  assertValidObjectId(id, 'league id');

  const existing = await LeagueModel.findById(id);
  if (!existing) {
    throw new AppError('League not found', 404, 'LEAGUE_NOT_FOUND');
  }

  const nextName = input.name ?? existing.name;
  const nextCountry = input.country ?? existing.country;

  if (input.name !== undefined || input.country !== undefined) {
    const duplicate = await LeagueModel.findOne({
      _id: { $ne: existing._id },
      name: nextName,
      country: nextCountry,
    }).collation({ locale: 'en', strength: 2 });

    if (duplicate) {
      throw new AppError(
        `League "${nextName}" already exists in "${nextCountry}"`,
        409,
        'LEAGUE_ALREADY_EXISTS',
      );
    }
  }

  const updated = await LeagueModel.findByIdAndUpdate(
    id,
    { $set: input },
    { returnDocument: 'after', runValidators: true },
  );

  if (!updated) {
    throw new AppError('League not found', 404, 'LEAGUE_NOT_FOUND');
  }

  return updated;
}

export async function deleteLeague(id: string): Promise<LeagueDocument> {
  assertValidObjectId(id, 'league id');

  const league = await LeagueModel.findById(id);
  if (!league) {
    throw new AppError('League not found', 404, 'LEAGUE_NOT_FOUND');
  }

  const seasonCount = await SeasonModel.countDocuments({ league: league._id });
  if (seasonCount > 0) {
    throw new AppError(
      'Cannot delete league with existing seasons. Delete its seasons first.',
      409,
      'LEAGUE_HAS_SEASONS',
    );
  }

  await league.deleteOne();
  return league;
}

export async function createSeason(
  leagueId: string,
  input: CreateSeasonInput,
): Promise<SeasonDocument> {
  assertValidObjectId(leagueId, 'league id');

  const league = await LeagueModel.findById(leagueId);
  if (!league) {
    throw new AppError('League not found', 404, 'LEAGUE_NOT_FOUND');
  }

  const existingSeason = await SeasonModel.findOne({
    league: league._id,
    name: input.name,
  }).collation({ locale: 'en', strength: 2 });

  if (existingSeason) {
    throw new AppError(
      `Season "${input.name}" already exists for this league`,
      409,
      'SEASON_ALREADY_EXISTS',
    );
  }

  if (input.current) {
    await SeasonModel.updateMany(
      { league: league._id, current: true },
      { $set: { current: false } },
    );
  }

  return await SeasonModel.create({
    league: league._id,
    ...input,
  });
}

export async function listSeasonsByLeague(
  leagueId: string,
): Promise<SeasonDocument[]> {
  assertValidObjectId(leagueId, 'league id');

  const league = await LeagueModel.findById(leagueId);
  if (!league) {
    throw new AppError('League not found', 404, 'LEAGUE_NOT_FOUND');
  }

  return await SeasonModel.find({ league: league._id }).sort({ startDate: -1 });
}

export async function updateSeason(
  leagueId: string,
  seasonId: string,
  input: UpdateSeasonInput,
): Promise<SeasonDocument> {
  assertValidObjectId(leagueId, 'league id');
  assertValidObjectId(seasonId, 'season id');

  const season = await SeasonModel.findOne({
    _id: seasonId,
    league: leagueId,
  });
  if (!season) {
    throw new AppError('Season not found for this league', 404, 'SEASON_NOT_FOUND');
  }

  const nextStart = input.startDate ?? season.startDate;
  const nextEnd = input.endDate ?? season.endDate;
  if (nextEnd.getTime() <= nextStart.getTime()) {
    throw new AppError(
      'endDate must be after startDate',
      400,
      'VALIDATION_ERROR',
    );
  }

  if (input.name !== undefined) {
    const duplicate = await SeasonModel.findOne({
      _id: { $ne: season._id },
      league: leagueId,
      name: input.name,
    }).collation({ locale: 'en', strength: 2 });

    if (duplicate) {
      throw new AppError(
        `Season "${input.name}" already exists for this league`,
        409,
        'SEASON_ALREADY_EXISTS',
      );
    }
  }

  if (input.current === true) {
    await SeasonModel.updateMany(
      { league: leagueId, _id: { $ne: season._id }, current: true },
      { $set: { current: false } },
    );
  }

  const updated = await SeasonModel.findByIdAndUpdate(
    season._id,
    { $set: input },
    { returnDocument: 'after', runValidators: true },
  );

  if (!updated) {
    throw new AppError('Season not found', 404, 'SEASON_NOT_FOUND');
  }

  return updated;
}

export async function deleteSeason(
  leagueId: string,
  seasonId: string,
): Promise<SeasonDocument> {
  assertValidObjectId(leagueId, 'league id');
  assertValidObjectId(seasonId, 'season id');

  const deleted = await SeasonModel.findOneAndDelete({
    _id: seasonId,
    league: leagueId,
  });

  if (!deleted) {
    throw new AppError('Season not found for this league', 404, 'SEASON_NOT_FOUND');
  }

  return deleted;
}
