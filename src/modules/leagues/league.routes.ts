import { Router } from 'express';
import {
  createLeagueController,
  createSeasonController,
  deleteLeagueController,
  deleteSeasonController,
  getLeagueByIdController,
  listLeaguesController,
  listSeasonsByLeagueController,
  updateLeagueController,
  updateSeasonController,
} from './league.controller';

const leagueRouter = Router();

leagueRouter.post('/', createLeagueController);
leagueRouter.get('/', listLeaguesController);
leagueRouter.get('/:id', getLeagueByIdController);
leagueRouter.patch('/:id', updateLeagueController);
leagueRouter.delete('/:id', deleteLeagueController);

leagueRouter.post('/:id/seasons', createSeasonController);
leagueRouter.get('/:id/seasons', listSeasonsByLeagueController);
leagueRouter.patch('/:id/seasons/:seasonId', updateSeasonController);
leagueRouter.delete('/:id/seasons/:seasonId', deleteSeasonController);

export default leagueRouter;
