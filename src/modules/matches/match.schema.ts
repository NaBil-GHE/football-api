import { z } from 'zod';
import { objectIdSchema, paginationQuerySchema } from '../../utils/validation';
import { MATCH_STATUSES } from './match.model';

const isoDateSchema = z.coerce.date().refine((date) => !Number.isNaN(date.getTime()), {
  message: 'Invalid ISO 8601 UTC date',
});

export const createMatchSchema = z
  .object({
    league: objectIdSchema,
    season: objectIdSchema,
    homeTeam: objectIdSchema,
    awayTeam: objectIdSchema,
    kickoff: isoDateSchema,
    venue: z.string().trim().min(2).max(150).optional(),
    status: z.enum(MATCH_STATUSES).default('scheduled'),
    homeScore: z.coerce.number().int().min(0).default(0),
    awayScore: z.coerce.number().int().min(0).default(0),
    minute: z.coerce.number().int().min(0).max(150).default(0),
    round: z.string().trim().min(1).max(60).optional(),
  })
  .refine((data) => data.homeTeam !== data.awayTeam, {
    message: 'Home team and away team must be different',
    path: ['awayTeam'],
  });

export const updateMatchSchema = z
  .object({
    league: objectIdSchema.optional(),
    season: objectIdSchema.optional(),
    homeTeam: objectIdSchema.optional(),
    awayTeam: objectIdSchema.optional(),
    kickoff: isoDateSchema.optional(),
    venue: z.string().trim().min(2).max(150).optional(),
    status: z.enum(MATCH_STATUSES).optional(),
    homeScore: z.coerce.number().int().min(0).optional(),
    awayScore: z.coerce.number().int().min(0).optional(),
    minute: z.coerce.number().int().min(0).max(150).optional(),
    round: z.string().trim().min(1).max(60).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const listMatchesQuerySchema = paginationQuerySchema.extend({
  league: objectIdSchema.optional(),
  season: objectIdSchema.optional(),
  team: objectIdSchema.optional(),
  status: z.enum(MATCH_STATUSES).optional(),
  round: z.string().trim().min(1).optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});

export const postponeMatchSchema = z.object({
  kickoff: isoDateSchema.optional(),
});

export const updateMatchMinuteSchema = z.object({
  minute: z.coerce.number().int().min(0).max(150),
});

export const updateMatchScoreSchema = z.object({
  homeScore: z.coerce.number().int().min(0),
  awayScore: z.coerce.number().int().min(0),
});

export type CreateMatchInput = z.infer<typeof createMatchSchema>;
export type UpdateMatchInput = z.infer<typeof updateMatchSchema>;
export type ListMatchesQuery = z.infer<typeof listMatchesQuerySchema>;
export type PostponeMatchInput = z.infer<typeof postponeMatchSchema>;
export type UpdateMatchMinuteInput = z.infer<typeof updateMatchMinuteSchema>;
export type UpdateMatchScoreInput = z.infer<typeof updateMatchScoreSchema>;
