import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/validation';
import { LEAGUE_TYPES } from './league.model';

const isoDateSchema = z.coerce.date().refine((date) => !Number.isNaN(date.getTime()), {
  message: 'Invalid ISO 8601 date',
});

export const createLeagueSchema = z.object({
  name: z.string().trim().min(2).max(120),
  country: z.string().trim().min(2).max(80),
  logo: z.string().trim().url('Logo must be a valid URL').optional(),
  type: z.enum(LEAGUE_TYPES).default('league'),
});

export const updateLeagueSchema = createLeagueSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const listLeaguesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  country: z.string().trim().min(1).optional(),
  type: z.enum(LEAGUE_TYPES).optional(),
});

export const createSeasonSchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    current: z.boolean().default(false),
  })
  .refine((data) => data.endDate.getTime() > data.startDate.getTime(), {
    message: 'endDate must be after startDate',
    path: ['endDate'],
  });

export const updateSeasonSchema = z
  .object({
    name: z.string().trim().min(2).max(60).optional(),
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.optional(),
    current: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export type CreateLeagueInput = z.infer<typeof createLeagueSchema>;
export type UpdateLeagueInput = z.infer<typeof updateLeagueSchema>;
export type ListLeaguesQuery = z.infer<typeof listLeaguesQuerySchema>;
export type CreateSeasonInput = z.infer<typeof createSeasonSchema>;
export type UpdateSeasonInput = z.infer<typeof updateSeasonSchema>;
