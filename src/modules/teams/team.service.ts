import type { QueryFilter } from 'mongoose';
import { AppError } from '../../utils/app-error';
import {
  buildPaginationMeta,
  parseSortParam,
  type PaginatedResult,
} from '../../utils/pagination';
import { assertValidObjectId, escapeRegex } from '../../utils/validation';
import { TeamModel, type TeamDocument } from './team.model';
import type {
  CreateTeamInput,
  ListTeamsQuery,
  UpdateTeamInput,
} from './team.schema';

const ALLOWED_TEAM_SORT_FIELDS = [
  'name',
  'shortName',
  'country',
  'founded',
  'createdAt',
] as const;

export async function createTeam(input: CreateTeamInput): Promise<TeamDocument> {
  const existing = await TeamModel.findOne({
    name: input.name,
    country: input.country,
  }).collation({ locale: 'en', strength: 2 });

  if (existing) {
    throw new AppError(
      `Team "${input.name}" already exists in "${input.country}"`,
      409,
      'TEAM_ALREADY_EXISTS',
    );
  }

  return await TeamModel.create(input);
}

export async function listTeams(
  query: ListTeamsQuery,
): Promise<PaginatedResult<TeamDocument>> {
  const filter: QueryFilter<TeamDocument> = {};

  if (query.country) {
    filter.country = new RegExp(`^${escapeRegex(query.country)}$`, 'i');
  }

  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ name: regex }, { shortName: regex }, { stadium: regex }];
  }

  const sort = parseSortParam(query.sort, ALLOWED_TEAM_SORT_FIELDS, { name: 1 });
  const skip = (query.page - 1) * query.limit;

  const [data, total] = await Promise.all([
    TeamModel.find(filter).sort(sort).skip(skip).limit(query.limit).exec(),
    TeamModel.countDocuments(filter),
  ]);

  return {
    data,
    pagination: buildPaginationMeta(total, query.page, query.limit),
  };
}

export async function getTeamById(id: string): Promise<TeamDocument> {
  assertValidObjectId(id, 'team id');

  const team = await TeamModel.findById(id);
  if (!team) {
    throw new AppError('Team not found', 404, 'TEAM_NOT_FOUND');
  }

  return team;
}

export async function updateTeam(
  id: string,
  input: UpdateTeamInput,
): Promise<TeamDocument> {
  assertValidObjectId(id, 'team id');

  const existingTeam = await TeamModel.findById(id);
  if (!existingTeam) {
    throw new AppError('Team not found', 404, 'TEAM_NOT_FOUND');
  }

  const nextName = input.name ?? existingTeam.name;
  const nextCountry = input.country ?? existingTeam.country;

  if (input.name !== undefined || input.country !== undefined) {
    const duplicate = await TeamModel.findOne({
      _id: { $ne: existingTeam._id },
      name: nextName,
      country: nextCountry,
    }).collation({ locale: 'en', strength: 2 });

    if (duplicate) {
      throw new AppError(
        `Team "${nextName}" already exists in "${nextCountry}"`,
        409,
        'TEAM_ALREADY_EXISTS',
      );
    }
  }

  const updated = await TeamModel.findByIdAndUpdate(
    id,
    { $set: input },
    { returnDocument: 'after', runValidators: true },
  );

  if (!updated) {
    throw new AppError('Team not found', 404, 'TEAM_NOT_FOUND');
  }

  return updated;
}

export async function deleteTeam(id: string): Promise<TeamDocument> {
  assertValidObjectId(id, 'team id');

  const deleted = await TeamModel.findByIdAndDelete(id);
  if (!deleted) {
    throw new AppError('Team not found', 404, 'TEAM_NOT_FOUND');
  }

  return deleted;
}
