import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth.middleware';
import {
  createTeamController,
  deleteTeamController,
  getTeamByIdController,
  listTeamsController,
  updateTeamController,
} from './team.controller';

const teamRouter = Router();

teamRouter.get('/', listTeamsController);
teamRouter.get('/:id', getTeamByIdController);

teamRouter.post('/', authenticate, requireAdmin, createTeamController);
teamRouter.patch('/:id', authenticate, requireAdmin, updateTeamController);
teamRouter.delete('/:id', authenticate, requireAdmin, deleteTeamController);

export default teamRouter;
