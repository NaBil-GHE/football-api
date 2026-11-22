import type { ClientSession } from 'mongoose';
import { AppError } from '../../utils/app-error';
import { runInTransaction } from '../../utils/transaction';
import { assertValidObjectId } from '../../utils/validation';
import { MatchModel, type MatchDocument } from '../matches/match.model';
import {
  MatchEventModel,
  type MatchEventDocument,
  type MatchEventType,
} from './match-event.model';
import type {
  CreateMatchEventInput,
  UpdateMatchEventInput,
} from './match-event.schema';

const GOAL_EVENT_TYPES = new Set<MatchEventType>(['goal', 'penalty', 'own_goal']);
const PLAYER_REQUIRED_TYPES = new Set<MatchEventType>([
  'goal',
  'own_goal',
  'penalty',
  'yellow_card',
  'red_card',
]);

function assertTeamInMatch(match: MatchDocument, teamId: string): void {
  const homeId = match.homeTeam.toString();
  const awayId = match.awayTeam.toString();

  if (teamId !== homeId && teamId !== awayId) {
    throw new AppError(
      'Team does not participate in this match',
      400,
      'TEAM_NOT_IN_MATCH',
    );
  }
}

function validateEventPlayerFields(event: {
  type: MatchEventType;
  player?: string | undefined;
  playerIn?: string | undefined;
  playerOut?: string | undefined;
}): void {
  if (event.type === 'substitution') {
    if (!event.playerIn || !event.playerOut) {
      throw new AppError(
        'playerIn and playerOut are required for substitution events',
        400,
        'VALIDATION_ERROR',
      );
    }
    if (event.playerIn.toLowerCase() === event.playerOut.toLowerCase()) {
      throw new AppError(
        'playerIn and playerOut must be different',
        400,
        'VALIDATION_ERROR',
      );
    }
  }

  if (PLAYER_REQUIRED_TYPES.has(event.type) && !event.player) {
    throw new AppError(
      `player is required for ${event.type} events`,
      400,
      'VALIDATION_ERROR',
    );
  }
}

export async function recalculateMatchScore(
  match: MatchDocument,
  session: ClientSession | null,
): Promise<{ homeScore: number; awayScore: number }> {
  const query = MatchEventModel.find({
    match: match._id,
    type: { $in: Array.from(GOAL_EVENT_TYPES) },
  });
  if (session) {
    query.session(session);
  }

  const goalEvents = await query.exec();
  const homeId = match.homeTeam.toString();
  const awayId = match.awayTeam.toString();

  let homeScore = 0;
  let awayScore = 0;

  for (const event of goalEvents) {
    const eventTeamId = event.team.toString();
    if (event.type === 'goal' || event.type === 'penalty') {
      if (eventTeamId === homeId) {
        homeScore += 1;
      } else if (eventTeamId === awayId) {
        awayScore += 1;
      }
    } else if (event.type === 'own_goal') {
      // Own goal awards a goal to the opposing team
      if (eventTeamId === homeId) {
        awayScore += 1;
      } else if (eventTeamId === awayId) {
        homeScore += 1;
      }
    }
  }

  await MatchModel.updateOne(
    { _id: match._id },
    { $set: { homeScore, awayScore } },
    session ? { session } : undefined,
  );

  return { homeScore, awayScore };
}

export interface CreateMatchEventMeta {
  isSimulated?: boolean;
  simulationStepId?: string;
}

export async function createMatchEvent(
  matchId: string,
  input: CreateMatchEventInput,
  meta?: CreateMatchEventMeta,
): Promise<{
  event: MatchEventDocument;
  score: { homeScore: number; awayScore: number };
}> {
  assertValidObjectId(matchId, 'match id');

  return await runInTransaction(async (session) => {
    const matchQuery = MatchModel.findById(matchId);
    if (session) {
      matchQuery.session(session);
    }
    const match = await matchQuery.exec();

    if (!match) {
      throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
    }

    assertTeamInMatch(match, input.team);

    // Idempotency guard for simulated events: return existing event if step already persisted
    if (meta?.simulationStepId) {
      const existingQuery = MatchEventModel.findOne({
        match: match._id,
        simulationStepId: meta.simulationStepId,
      }).populate('team', 'name shortName logo');
      if (session) {
        existingQuery.session(session);
      }
      const existing = await existingQuery.exec();
      if (existing) {
        return {
          event: existing,
          score: { homeScore: match.homeScore, awayScore: match.awayScore },
        };
      }
    }

    const createdDocs = await MatchEventModel.create(
      [
        {
          match: match._id,
          team: input.team,
          type: input.type,
          minute: input.minute,
          addedTime: input.addedTime,
          player: input.player,
          playerIn: input.playerIn,
          playerOut: input.playerOut,
          description: input.description,
          isSimulated: meta?.isSimulated ?? false,
          ...(meta?.simulationStepId
            ? { simulationStepId: meta.simulationStepId }
            : {}),
        },
      ],
      session ? { session } : undefined,
    );

    const created = createdDocs[0];
    if (!created) {
      throw new AppError('Failed to create match event', 500, 'INTERNAL_SERVER_ERROR');
    }

    const score = GOAL_EVENT_TYPES.has(input.type)
      ? await recalculateMatchScore(match, session)
      : { homeScore: match.homeScore, awayScore: match.awayScore };

    const populatedQuery = MatchEventModel.findById(created._id).populate(
      'team',
      'name shortName logo',
    );
    if (session) {
      populatedQuery.session(session);
    }
    const populated = await populatedQuery.exec();

    return {
      event: populated ?? created,
      score,
    };
  });
}

export async function listMatchEvents(
  matchId: string,
): Promise<MatchEventDocument[]> {
  assertValidObjectId(matchId, 'match id');

  const match = await MatchModel.findById(matchId);
  if (!match) {
    throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
  }

  return await MatchEventModel.find({ match: match._id })
    .populate('team', 'name shortName logo')
    .sort({ minute: 1, addedTime: 1, createdAt: 1 })
    .exec();
}

export async function getMatchEventById(
  matchId: string,
  eventId: string,
): Promise<MatchEventDocument> {
  assertValidObjectId(matchId, 'match id');
  assertValidObjectId(eventId, 'event id');

  const event = await MatchEventModel.findOne({
    _id: eventId,
    match: matchId,
  }).populate('team', 'name shortName logo');

  if (!event) {
    throw new AppError(
      'Match event not found for this match',
      404,
      'MATCH_EVENT_NOT_FOUND',
    );
  }

  return event;
}

export async function updateMatchEvent(
  matchId: string,
  eventId: string,
  input: UpdateMatchEventInput,
): Promise<{
  event: MatchEventDocument;
  score: { homeScore: number; awayScore: number };
}> {
  assertValidObjectId(matchId, 'match id');
  assertValidObjectId(eventId, 'event id');

  return await runInTransaction(async (session) => {
    const matchQuery = MatchModel.findById(matchId);
    const eventQuery = MatchEventModel.findOne({ _id: eventId, match: matchId });
    if (session) {
      matchQuery.session(session);
      eventQuery.session(session);
    }

    const match = await matchQuery.exec();
    const existingEvent = await eventQuery.exec();

    if (!match) {
      throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
    }
    if (!existingEvent) {
      throw new AppError(
        'Match event not found for this match',
        404,
        'MATCH_EVENT_NOT_FOUND',
      );
    }

    const nextTeam = input.team ?? existingEvent.team.toString();
    assertTeamInMatch(match, nextTeam);

    const nextType = input.type ?? existingEvent.type;
    validateEventPlayerFields({
      type: nextType,
      player: input.player ?? existingEvent.player,
      playerIn: input.playerIn ?? existingEvent.playerIn,
      playerOut: input.playerOut ?? existingEvent.playerOut,
    });

    const affectedScore =
      GOAL_EVENT_TYPES.has(existingEvent.type) || GOAL_EVENT_TYPES.has(nextType);

    const updated = await MatchEventModel.findByIdAndUpdate(
      existingEvent._id,
      { $set: input },
      {
        returnDocument: 'after',
        runValidators: true,
        ...(session ? { session } : {}),
      },
    ).populate('team', 'name shortName logo');

    if (!updated) {
      throw new AppError('Match event not found', 404, 'MATCH_EVENT_NOT_FOUND');
    }

    const score = affectedScore
      ? await recalculateMatchScore(match, session)
      : { homeScore: match.homeScore, awayScore: match.awayScore };

    return {
      event: updated,
      score,
    };
  });
}

export async function deleteMatchEvent(
  matchId: string,
  eventId: string,
): Promise<{ score: { homeScore: number; awayScore: number } }> {
  assertValidObjectId(matchId, 'match id');
  assertValidObjectId(eventId, 'event id');

  return await runInTransaction(async (session) => {
    const matchQuery = MatchModel.findById(matchId);
    const eventQuery = MatchEventModel.findOne({ _id: eventId, match: matchId });
    if (session) {
      matchQuery.session(session);
      eventQuery.session(session);
    }

    const match = await matchQuery.exec();
    const existingEvent = await eventQuery.exec();

    if (!match) {
      throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
    }
    if (!existingEvent) {
      throw new AppError(
        'Match event not found for this match',
        404,
        'MATCH_EVENT_NOT_FOUND',
      );
    }

    const wasGoal = GOAL_EVENT_TYPES.has(existingEvent.type);

    await MatchEventModel.deleteOne(
      { _id: existingEvent._id },
      session ? { session } : undefined,
    );

    const score = wasGoal
      ? await recalculateMatchScore(match, session)
      : { homeScore: match.homeScore, awayScore: match.awayScore };

    return { score };
  });
}
