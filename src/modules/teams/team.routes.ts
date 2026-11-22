import { Router } from 'express';
import {
  createTeamController,
  deleteTeamController,
  getTeamByIdController,
  listTeamsController,
  updateTeamController,
} from './team.controller';

const teamRouter = Router();

teamRouter.post('/', createTeamController);
teamRouter.get('/', listTeamsController);
teamRouter.get('/:id', getTeamByIdController);
teamRouter.patch('/:id', updateTeamController);
teamRouter.delete('/:id', deleteTeamController);

export default teamRouter;
