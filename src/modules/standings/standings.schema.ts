import { z } from 'zod';
import { objectIdSchema } from '../../utils/validation';

export const standingsQuerySchema = z.object({
  season: objectIdSchema.optional(),
});

export type StandingsQuery = z.infer<typeof standingsQuerySchema>;
