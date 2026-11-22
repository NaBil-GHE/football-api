import type { NextFunction, Request, Response } from 'express';
import { parseSchema } from '../../utils/validation';
import {
  resetSimulationSchema,
  startSimulationSchema,
  updateSimulationSpeedSchema,
} from './match.schema';
import * as simulationService from './match-simulation.service';

export async function getSimulationController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const state = await simulationService.getSimulationState(
      String(req.params.id),
    );
    res.status(200).json({ success: true, data: state });
  } catch (error) {
    next(error);
  }
}

export async function startSimulationController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = parseSchema(startSimulationSchema, req.body ?? {});
    const state = await simulationService.startSimulation(
      String(req.params.id),
      input,
    );
    res.status(200).json({ success: true, data: state });
  } catch (error) {
    next(error);
  }
}

export async function pauseSimulationController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const state = await simulationService.pauseSimulation(
      String(req.params.id),
    );
    res.status(200).json({ success: true, data: state });
  } catch (error) {
    next(error);
  }
}

export async function resumeSimulationController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const state = await simulationService.resumeSimulation(
      String(req.params.id),
    );
    res.status(200).json({ success: true, data: state });
  } catch (error) {
    next(error);
  }
}

export async function changeSimulationSpeedController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { simulationSpeed } = parseSchema(
      updateSimulationSpeedSchema,
      req.body,
    );
    const state = await simulationService.changeSimulationSpeed(
      String(req.params.id),
      simulationSpeed,
    );
    res.status(200).json({ success: true, data: state });
  } catch (error) {
    next(error);
  }
}

export async function advanceSimulationController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const state = await simulationService.advanceSimulationNextEvent(
      String(req.params.id),
    );
    res.status(200).json({ success: true, data: state });
  } catch (error) {
    next(error);
  }
}

export async function stopSimulationController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const state = await simulationService.stopSimulation(String(req.params.id));
    res.status(200).json({ success: true, data: state });
  } catch (error) {
    next(error);
  }
}

export async function resetSimulationController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = parseSchema(resetSimulationSchema, req.body ?? {});
    const state = await simulationService.resetSimulation(
      String(req.params.id),
      input,
    );
    res.status(200).json({ success: true, data: state });
  } catch (error) {
    next(error);
  }
}
