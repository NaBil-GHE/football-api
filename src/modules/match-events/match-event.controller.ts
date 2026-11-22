import type { NextFunction, Request, Response } from 'express';
import { parseSchema } from '../../utils/validation';
import {
  createMatchEventSchema,
  updateMatchEventSchema,
} from './match-event.schema';
import * as matchEventService from './match-event.service';

export async function createMatchEventController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = parseSchema(createMatchEventSchema, req.body);
    const result = await matchEventService.createMatchEvent(
      String(req.params.id),
      input,
    );

    res.status(201).json({
      success: true,
      data: result.event,
      score: result.score,
    });
  } catch (error) {
    next(error);
  }
}

export async function listMatchEventsController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const events = await matchEventService.listMatchEvents(
      String(req.params.id),
    );

    res.status(200).json({
      success: true,
      data: events,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMatchEventByIdController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const event = await matchEventService.getMatchEventById(
      String(req.params.id),
      String(req.params.eventId),
    );

    res.status(200).json({
      success: true,
      data: event,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateMatchEventController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = parseSchema(updateMatchEventSchema, req.body);
    const result = await matchEventService.updateMatchEvent(
      String(req.params.id),
      String(req.params.eventId),
      input,
    );

    res.status(200).json({
      success: true,
      data: result.event,
      score: result.score,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteMatchEventController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await matchEventService.deleteMatchEvent(
      String(req.params.id),
      String(req.params.eventId),
    );

    res.status(200).json({
      success: true,
      message: 'Match event deleted successfully',
      score: result.score,
    });
  } catch (error) {
    next(error);
  }
}
