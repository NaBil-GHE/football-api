import { Router } from 'express';
import {
  createMatchController,
  deleteMatchController,
  getMatchByIdController,
  listFinishedMatchesController,
  listLiveMatchesController,
  listMatchesController,
  listTeamMatchesController,
  listTodayMatchesController,
  listUpcomingMatchesController,
  updateMatchController,
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

export default matchRouter;
