import { Router } from 'express';
import {
  createMatchEventController,
  deleteMatchEventController,
  getMatchEventByIdController,
  listMatchEventsController,
  updateMatchEventController,
} from './match-event.controller';

const matchEventRouter = Router({ mergeParams: true });

matchEventRouter.post('/', createMatchEventController);
matchEventRouter.get('/', listMatchEventsController);
matchEventRouter.get('/:eventId', getMatchEventByIdController);
matchEventRouter.patch('/:eventId', updateMatchEventController);
matchEventRouter.delete('/:eventId', deleteMatchEventController);

export default matchEventRouter;
