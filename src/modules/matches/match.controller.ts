import type { NextFunction, Request, Response } from 'express';
import { parseSchema } from '../../utils/validation';
import {
  createMatchSchema,
  listMatchesQuerySchema,
  updateMatchSchema,
} from './match.schema';
import * as matchService from './match.service';

export async function createMatchController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = parseSchema(createMatchSchema, req.body);
    const match = await matchService.createMatch(input);

    res.status(201).json({
      success: true,
      data: match,
    });
  } catch (error) {
    next(error);
  }
}

export async function listMatchesController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = parseSchema(listMatchesQuerySchema, req.query);
    const result = await matchService.listMatches(query);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

export async function listTodayMatchesController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = parseSchema(listMatchesQuerySchema, req.query);
    const result = await matchService.listTodayMatches(query);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

export async function listUpcomingMatchesController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = parseSchema(listMatchesQuerySchema, req.query);
    const result = await matchService.listUpcomingMatches(query);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

export async function listLiveMatchesController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = parseSchema(listMatchesQuerySchema, req.query);
    const result = await matchService.listLiveMatches(query);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

export async function listFinishedMatchesController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = parseSchema(listMatchesQuerySchema, req.query);
    const result = await matchService.listFinishedMatches(query);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

export async function listTeamMatchesController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = parseSchema(listMatchesQuerySchema, req.query);
    const result = await matchService.listTeamMatches(
      String(req.params.teamId),
      query,
    );

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMatchByIdController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const match = await matchService.getMatchById(String(req.params.id));

    res.status(200).json({
      success: true,
      data: match,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateMatchController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = parseSchema(updateMatchSchema, req.body);
    const match = await matchService.updateMatch(String(req.params.id), input);

    res.status(200).json({
      success: true,
      data: match,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteMatchController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await matchService.deleteMatch(String(req.params.id));

    res.status(200).json({
      success: true,
      message: 'Match deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}
