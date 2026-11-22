import mongoose from 'mongoose';
import { z, type ZodType } from 'zod';
import { AppError } from './app-error';

export const objectIdSchema = z
  .string()
  .trim()
  .refine((value) => mongoose.Types.ObjectId.isValid(value), {
    message: 'Invalid ObjectId format',
  });

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().trim().optional(),
});

export function assertValidObjectId(id: string, label = 'id'): void {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${label} format`, 400, 'INVALID_ID');
  }
}

export function parseSchema<T>(schema: ZodType<T>, input: unknown): T {
  return schema.parse(input);
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
