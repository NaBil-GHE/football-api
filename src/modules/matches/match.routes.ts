import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth.middleware';
import matchEventRouter from '../match-events/match-event.routes';
import {
  advanceSimulationController,
  changeSimulationSpeedController,
  getSimulationController,
  pauseSimulationController,
  resetSimulationController,
  resumeSimulationController,
  startSimulationController,
  stopSimulationController,
} from './match-simulation.controller';
import {
  cancelMatchController,
  createMatchController,
  deleteMatchController,
  finishMatchController,
  getMatchByIdController,
  halftimeMatchController,
  listFinishedMatchesController,
  listLiveMatchesController,
  listMatchesController,
  listTeamMatchesController,
  listTodayMatchesController,
  listUpcomingMatchesController,
  postponeMatchController,
  resumeMatchController,
  startMatchController,
  updateMatchController,
  updateMatchMinuteController,
  updateMatchScoreController,
} from './match.controller';

const matchRouter = Router();

matchRouter.get('/today', listTodayMatchesController);
matchRouter.get('/upcoming', listUpcomingMatchesController);
matchRouter.get('/live', listLiveMatchesController);
matchRouter.get('/finished', listFinishedMatchesController);
matchRouter.get('/team/:teamId', listTeamMatchesController);

matchRouter.get('/', listMatchesController);
matchRouter.get('/:id', getMatchByIdController);

matchRouter.post('/', authenticate, requireAdmin, createMatchController);
matchRouter.patch('/:id', authenticate, requireAdmin, updateMatchController);
matchRouter.delete('/:id', authenticate, requireAdmin, deleteMatchController);

matchRouter.post('/:id/start', authenticate, requireAdmin, startMatchController);
matchRouter.post(
  '/:id/halftime',
  authenticate,
  requireAdmin,
  halftimeMatchController,
);
matchRouter.post(
  '/:id/resume',
  authenticate,
  requireAdmin,
  resumeMatchController,
);
matchRouter.post(
  '/:id/finish',
  authenticate,
  requireAdmin,
  finishMatchController,
);
matchRouter.post(
  '/:id/postpone',
  authenticate,
  requireAdmin,
  postponeMatchController,
);
matchRouter.post(
  '/:id/cancel',
  authenticate,
  requireAdmin,
  cancelMatchController,
);
matchRouter.patch(
  '/:id/minute',
  authenticate,
  requireAdmin,
  updateMatchMinuteController,
);
matchRouter.patch(
  '/:id/score',
  authenticate,
  requireAdmin,
  updateMatchScoreController,
);

matchRouter.get('/:id/simulation', getSimulationController);
matchRouter.post(
  '/:id/simulation/start',
  authenticate,
  requireAdmin,
  startSimulationController,
);
matchRouter.post(
  '/:id/simulation/pause',
  authenticate,
  requireAdmin,
  pauseSimulationController,
);
matchRouter.post(
  '/:id/simulation/resume',
  authenticate,
  requireAdmin,
  resumeSimulationController,
);
matchRouter.patch(
  '/:id/simulation/speed',
  authenticate,
  requireAdmin,
  changeSimulationSpeedController,
);
matchRouter.post(
  '/:id/simulation/next',
  authenticate,
  requireAdmin,
  advanceSimulationController,
);
matchRouter.post(
  '/:id/simulation/stop',
  authenticate,
  requireAdmin,
  stopSimulationController,
);
matchRouter.post(
  '/:id/simulation/reset',
  authenticate,
  requireAdmin,
  resetSimulationController,
);

matchRouter.use('/:id/events', matchEventRouter);

export default matchRouter;
