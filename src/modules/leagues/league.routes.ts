import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth.middleware';
import { getLeagueStandingsController } from '../standings/standings.controller';
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

leagueRouter.get('/', listLeaguesController);
leagueRouter.get('/:id', getLeagueByIdController);
leagueRouter.get('/:id/seasons', listSeasonsByLeagueController);
leagueRouter.get('/:id/standings', getLeagueStandingsController);

leagueRouter.post('/', authenticate, requireAdmin, createLeagueController);
leagueRouter.patch('/:id', authenticate, requireAdmin, updateLeagueController);
leagueRouter.delete('/:id', authenticate, requireAdmin, deleteLeagueController);

leagueRouter.post(
  '/:id/seasons',
  authenticate,
  requireAdmin,
  createSeasonController,
);
leagueRouter.patch(
  '/:id/seasons/:seasonId',
  authenticate,
  requireAdmin,
  updateSeasonController,
);
leagueRouter.delete(
  '/:id/seasons/:seasonId',
  authenticate,
  requireAdmin,
  deleteSeasonController,
);

export default leagueRouter;
