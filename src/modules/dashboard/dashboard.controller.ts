import type { NextFunction, Request, Response } from 'express';
import { parseSchema } from '../../utils/validation';
import { dashboardListQuerySchema } from './dashboard.schema';
import * as dashboardService from './dashboard.service';

export async function getOverviewController(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const overview = await dashboardService.getDashboardOverview();
    res.status(200).json({ success: true, data: overview });
  } catch (error) {
    next(error);
  }
}

export async function getLiveMatchesController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { limit } = parseSchema(dashboardListQuerySchema, req.query);
    const data = await dashboardService.getDashboardLiveMatches(limit);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getUpcomingMatchesController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { limit } = parseSchema(dashboardListQuerySchema, req.query);
    const data = await dashboardService.getDashboardUpcomingMatches(limit);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getRecentResultsController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { limit } = parseSchema(dashboardListQuerySchema, req.query);
    const data = await dashboardService.getDashboardRecentResults(limit);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
