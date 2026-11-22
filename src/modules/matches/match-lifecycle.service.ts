import { AppError } from '../../utils/app-error';
import { assertValidObjectId } from '../../utils/validation';
import {
  MatchModel,
  type MatchDocument,
  type MatchStatus,
} from './match.model';
import { MATCH_POPULATE } from './match.service';

const ALLOWED_TRANSITIONS: Record<MatchStatus, readonly MatchStatus[]> = {
  scheduled: ['live', 'postponed', 'cancelled'],
  postponed: ['scheduled', 'live', 'cancelled'],
  live: ['halftime', 'finished', 'postponed', 'cancelled'],
  halftime: ['live', 'finished', 'postponed', 'cancelled'],
  finished: [],
  cancelled: [],
};

export function assertValidStatusTransition(
  current: MatchStatus,
  target: MatchStatus,
): void {
  if (current === target) {
    return;
  }

  const allowed = ALLOWED_TRANSITIONS[current];
  if (!allowed.includes(target)) {
    throw new AppError(
      `Invalid match status transition from "${current}" to "${target}"`,
      400,
      'INVALID_STATUS_TRANSITION',
    );
  }
}

async function getMatchOrThrow(id: string): Promise<MatchDocument> {
  assertValidObjectId(id, 'match id');
  const match = await MatchModel.findById(id);
  if (!match) {
    throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
  }
  return match;
}

async function saveAndPopulate(match: MatchDocument): Promise<MatchDocument> {
  await match.save();
  const populated = await MatchModel.findById(match._id).populate(MATCH_POPULATE);
  return populated ?? match;
}

export async function startMatch(id: string): Promise<MatchDocument> {
  const match = await getMatchOrThrow(id);

  if (match.status !== 'scheduled' && match.status !== 'postponed') {
    throw new AppError(
      `Cannot start a match with status "${match.status}"`,
      400,
      'INVALID_STATUS_TRANSITION',
    );
  }

  match.status = 'live';
  if (match.minute === 0) {
    match.minute = 1;
  }

  return await saveAndPopulate(match);
}

export async function setHalftime(id: string): Promise<MatchDocument> {
  const match = await getMatchOrThrow(id);

  if (match.status !== 'live') {
    throw new AppError(
      `Cannot move match to halftime from status "${match.status}"`,
      400,
      'INVALID_STATUS_TRANSITION',
    );
  }

  match.status = 'halftime';
  if (match.minute < 45) {
    match.minute = 45;
  }

  return await saveAndPopulate(match);
}

export async function resumeMatch(id: string): Promise<MatchDocument> {
  const match = await getMatchOrThrow(id);

  if (match.status !== 'halftime') {
    throw new AppError(
      `Cannot resume a match from status "${match.status}"`,
      400,
      'INVALID_STATUS_TRANSITION',
    );
  }

  match.status = 'live';
  if (match.minute < 46) {
    match.minute = 46;
  }

  return await saveAndPopulate(match);
}

export async function finishMatch(id: string): Promise<MatchDocument> {
  const match = await getMatchOrThrow(id);

  if (match.status !== 'live' && match.status !== 'halftime') {
    throw new AppError(
      `Cannot finish a match with status "${match.status}"`,
      400,
      'INVALID_STATUS_TRANSITION',
    );
  }

  match.status = 'finished';
  if (match.minute < 90) {
    match.minute = 90;
  }

  return await saveAndPopulate(match);
}

export async function postponeMatch(
  id: string,
  newKickoff?: Date,
): Promise<MatchDocument> {
  const match = await getMatchOrThrow(id);

  if (
    match.status !== 'scheduled' &&
    match.status !== 'live' &&
    match.status !== 'halftime'
  ) {
    throw new AppError(
      `Cannot postpone a match with status "${match.status}"`,
      400,
      'INVALID_STATUS_TRANSITION',
    );
  }

  match.status = 'postponed';
  if (newKickoff) {
    match.kickoff = newKickoff;
  }

  return await saveAndPopulate(match);
}

export async function cancelMatch(id: string): Promise<MatchDocument> {
  const match = await getMatchOrThrow(id);

  if (match.status === 'finished' || match.status === 'cancelled') {
    throw new AppError(
      `Cannot cancel a match with status "${match.status}"`,
      400,
      'INVALID_STATUS_TRANSITION',
    );
  }

  match.status = 'cancelled';
  return await saveAndPopulate(match);
}

export async function updateMatchMinute(
  id: string,
  minute: number,
): Promise<MatchDocument> {
  const match = await getMatchOrThrow(id);

  if (match.status !== 'live' && match.status !== 'halftime') {
    throw new AppError(
      `Cannot update minute while match status is "${match.status}"`,
      400,
      'INVALID_MATCH_STATE',
    );
  }

  match.minute = minute;
  return await saveAndPopulate(match);
}

export async function updateMatchScore(
  id: string,
  homeScore: number,
  awayScore: number,
): Promise<MatchDocument> {
  const match = await getMatchOrThrow(id);

  if (
    match.status !== 'live' &&
    match.status !== 'halftime' &&
    match.status !== 'finished'
  ) {
    throw new AppError(
      `Cannot update score while match status is "${match.status}"`,
      400,
      'INVALID_MATCH_STATE',
    );
  }

  match.homeScore = homeScore;
  match.awayScore = awayScore;
  return await saveAndPopulate(match);
}
