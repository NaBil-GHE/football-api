import type { NextFunction, Request, Response } from 'express';
import { parseSchema } from '../../utils/validation';
import {
  createLeagueSchema,
  createSeasonSchema,
  listLeaguesQuerySchema,
  updateLeagueSchema,
  updateSeasonSchema,
} from './league.schema';
import * as leagueService from './league.service';

export async function createLeagueController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = parseSchema(createLeagueSchema, req.body);
    const league = await leagueService.createLeague(input);

    res.status(201).json({
      success: true,
      data: league,
    });
  } catch (error) {
    next(error);
  }
}

export async function listLeaguesController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = parseSchema(listLeaguesQuerySchema, req.query);
    const result = await leagueService.listLeagues(query);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getLeagueByIdController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { league, seasons } = await leagueService.getLeagueById(
      String(req.params.id),
    );

    res.status(200).json({
      success: true,
      data: {
        ...league.toObject(),
        seasons,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateLeagueController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = parseSchema(updateLeagueSchema, req.body);
    const league = await leagueService.updateLeague(
      String(req.params.id),
      input,
    );

    res.status(200).json({
      success: true,
      data: league,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteLeagueController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await leagueService.deleteLeague(String(req.params.id));

    res.status(200).json({
      success: true,
      message: 'League deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function createSeasonController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = parseSchema(createSeasonSchema, req.body);
    const season = await leagueService.createSeason(
      String(req.params.id),
      input,
    );

    res.status(201).json({
      success: true,
      data: season,
    });
  } catch (error) {
    next(error);
  }
}

export async function listSeasonsByLeagueController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const seasons = await leagueService.listSeasonsByLeague(
      String(req.params.id),
    );

    res.status(200).json({
      success: true,
      data: seasons,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateSeasonController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = parseSchema(updateSeasonSchema, req.body);
    const season = await leagueService.updateSeason(
      String(req.params.id),
      String(req.params.seasonId),
      input,
    );

    res.status(200).json({
      success: true,
      data: season,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteSeasonController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await leagueService.deleteSeason(
      String(req.params.id),
      String(req.params.seasonId),
    );

    res.status(200).json({
      success: true,
      message: 'Season deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}
