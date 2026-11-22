import { z } from 'zod';
import { objectIdSchema } from '../../utils/validation';
import { MATCH_EVENT_TYPES } from './match-event.model';

const PLAYER_REQUIRED_TYPES = new Set([
  'goal',
  'own_goal',
  'penalty',
  'yellow_card',
  'red_card',
]);

export const createMatchEventSchema = z
  .object({
    team: objectIdSchema,
    type: z.enum(MATCH_EVENT_TYPES),
    minute: z.coerce.number().int().min(0).max(150),
    addedTime: z.coerce.number().int().min(0).max(30).default(0),
    player: z.string().trim().min(1).max(100).optional(),
    playerIn: z.string().trim().min(1).max(100).optional(),
    playerOut: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'substitution') {
      if (!data.playerIn) {
        ctx.addIssue({
          code: 'custom',
          path: ['playerIn'],
          message: 'playerIn is required for substitution events',
        });
      }
      if (!data.playerOut) {
        ctx.addIssue({
          code: 'custom',
          path: ['playerOut'],
          message: 'playerOut is required for substitution events',
        });
      }
      if (
        data.playerIn &&
        data.playerOut &&
        data.playerIn.toLowerCase() === data.playerOut.toLowerCase()
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['playerIn'],
          message: 'playerIn and playerOut must be different',
        });
      }
    }

    if (PLAYER_REQUIRED_TYPES.has(data.type) && !data.player) {
      ctx.addIssue({
        code: 'custom',
        path: ['player'],
        message: `player is required for ${data.type} events`,
      });
    }
  });

export const updateMatchEventSchema = z
  .object({
    team: objectIdSchema.optional(),
    type: z.enum(MATCH_EVENT_TYPES).optional(),
    minute: z.coerce.number().int().min(0).max(150).optional(),
    addedTime: z.coerce.number().int().min(0).max(30).optional(),
    player: z.string().trim().min(1).max(100).optional(),
    playerIn: z.string().trim().min(1).max(100).optional(),
    playerOut: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(500).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export type CreateMatchEventInput = z.infer<typeof createMatchEventSchema>;
export type UpdateMatchEventInput = z.infer<typeof updateMatchEventSchema>;
