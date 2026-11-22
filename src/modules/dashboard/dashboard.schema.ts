import { z } from 'zod';

export const dashboardListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type DashboardListQuery = z.infer<typeof dashboardListQuerySchema>;
