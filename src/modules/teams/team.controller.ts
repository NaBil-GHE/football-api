import type { NextFunction, Request, Response } from 'express';
import { parseSchema } from '../../utils/validation';
import {
  createTeamSchema,
  listTeamsQuerySchema,
  updateTeamSchema,
} from './team.schema';
import * as teamService from './team.service';

export async function createTeamController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = parseSchema(createTeamSchema, req.body);
    const team = await teamService.createTeam(input);

    res.status(201).json({
      success: true,
      data: team,
    });
  } catch (error) {
    next(error);
  }
}

export async function listTeamsController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = parseSchema(listTeamsQuerySchema, req.query);
    const result = await teamService.listTeams(query);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getTeamByIdController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const team = await teamService.getTeamById(String(req.params.id));

    res.status(200).json({
      success: true,
      data: team,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateTeamController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = parseSchema(updateTeamSchema, req.body);
    const team = await teamService.updateTeam(String(req.params.id), input);

    res.status(200).json({
      success: true,
      data: team,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteTeamController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await teamService.deleteTeam(String(req.params.id));

    res.status(200).json({
      success: true,
      message: 'Team deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}
