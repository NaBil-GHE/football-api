import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/validation';

const currentYear = new Date().getUTCFullYear();

export const createTeamSchema = z.object({
  name: z.string().trim().min(2, 'Team name must be at least 2 characters').max(120),
  shortName: z
    .string()
    .trim()
    .min(2, 'Short name must be at least 2 characters')
    .max(20)
    .transform((value) => value.toUpperCase()),
  country: z.string().trim().min(2, 'Country must be at least 2 characters').max(80),
  logo: z.string().trim().url('Logo must be a valid URL').optional(),
  founded: z.coerce.number().int().min(1850).max(currentYear + 1).optional(),
  stadium: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(1000).optional(),
});

export const updateTeamSchema = createTeamSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const listTeamsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  country: z.string().trim().min(1).optional(),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type ListTeamsQuery = z.infer<typeof listTeamsQuerySchema>;
