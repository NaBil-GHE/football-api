import { z } from 'zod';
import { objectIdSchema, paginationQuerySchema } from '../../utils/validation';
import { MATCH_STATUSES } from './match.model';

const isoDateSchema = z.coerce.date().refine((date) => !Number.isNaN(date.getTime()), {
  message: 'Invalid ISO 8601 UTC date',
});

export const simulationConfigSchema = z
  .object({
    matchDuration: z.coerce.number().int().min(10).max(120).default(90),
    eventFrequency: z.coerce.number().int().min(2).max(30).default(12),
    goalProbability: z.coerce.number().min(0).max(1).default(0.22),
    cardProbability: z.coerce.number().min(0).max(1).default(0.38),
    substitutionProbability: z.coerce.number().min(0).max(1).default(0.32),
  })
  .refine(
    (cfg) =>
      cfg.goalProbability + cfg.cardProbability + cfg.substitutionProbability <=
      1.0001,
    {
      message:
        'Sum of goalProbability, cardProbability, and substitutionProbability cannot exceed 1',
    },
  );

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
    isSimulation: z.boolean().default(false),
    simulationSpeed: z.coerce.number().min(1).max(120).default(10),
    simulationSeed: z.string().trim().min(1).max(120).optional(),
    simulationConfig: simulationConfigSchema.optional(),
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
    isSimulation: z.boolean().optional(),
    simulationSpeed: z.coerce.number().min(1).max(120).optional(),
    simulationSeed: z.string().trim().min(1).max(120).optional(),
    simulationConfig: simulationConfigSchema.optional(),
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
  isSimulation: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
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

export const startSimulationSchema = z.object({
  simulationSpeed: z.coerce.number().min(1).max(120).optional(),
  simulationSeed: z.string().trim().min(1).max(120).optional(),
  simulationConfig: simulationConfigSchema.optional(),
});

export const updateSimulationSpeedSchema = z.object({
  simulationSpeed: z.coerce.number().min(1).max(120),
});

export const resetSimulationSchema = z.object({
  simulationSeed: z.string().trim().min(1).max(120).optional(),
  simulationSpeed: z.coerce.number().min(1).max(120).optional(),
  simulationConfig: simulationConfigSchema.optional(),
});

export type CreateMatchInput = z.infer<typeof createMatchSchema>;
export type UpdateMatchInput = z.infer<typeof updateMatchSchema>;
export type ListMatchesQuery = z.infer<typeof listMatchesQuerySchema>;
export type PostponeMatchInput = z.infer<typeof postponeMatchSchema>;
export type UpdateMatchMinuteInput = z.infer<typeof updateMatchMinuteSchema>;
export type UpdateMatchScoreInput = z.infer<typeof updateMatchScoreSchema>;
export type SimulationConfigInput = z.infer<typeof simulationConfigSchema>;
export type StartSimulationInput = z.infer<typeof startSimulationSchema>;
export type UpdateSimulationSpeedInput = z.infer<typeof updateSimulationSpeedSchema>;
export type ResetSimulationInput = z.infer<typeof resetSimulationSchema>;
