import { Router } from 'express';
import matchEventRouter from '../match-events/match-event.routes';
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

matchRouter.post('/', createMatchController);
matchRouter.get('/', listMatchesController);
matchRouter.get('/:id', getMatchByIdController);
matchRouter.patch('/:id', updateMatchController);
matchRouter.delete('/:id', deleteMatchController);

matchRouter.post('/:id/start', startMatchController);
matchRouter.post('/:id/halftime', halftimeMatchController);
matchRouter.post('/:id/resume', resumeMatchController);
matchRouter.post('/:id/finish', finishMatchController);
matchRouter.post('/:id/postpone', postponeMatchController);
matchRouter.post('/:id/cancel', cancelMatchController);
matchRouter.patch('/:id/minute', updateMatchMinuteController);
matchRouter.patch('/:id/score', updateMatchScoreController);

matchRouter.use('/:id/events', matchEventRouter);

export default matchRouter;
