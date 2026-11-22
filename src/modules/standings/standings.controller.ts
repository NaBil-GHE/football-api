import type { NextFunction, Request, Response } from 'express';
import { parseSchema } from '../../utils/validation';
import { standingsQuerySchema } from './standings.schema';
import { getLeagueStandings } from './standings.service';

export async function getLeagueStandingsController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = parseSchema(standingsQuerySchema, req.query);
    const result = await getLeagueStandings(String(req.params.id), query.season);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
