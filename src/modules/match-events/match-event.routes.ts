import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth.middleware';
import {
  createMatchEventController,
  deleteMatchEventController,
  getMatchEventByIdController,
  listMatchEventsController,
  updateMatchEventController,
} from './match-event.controller';

const matchEventRouter = Router({ mergeParams: true });

matchEventRouter.get('/', listMatchEventsController);
matchEventRouter.get('/:eventId', getMatchEventByIdController);

matchEventRouter.post('/', authenticate, requireAdmin, createMatchEventController);
matchEventRouter.patch(
  '/:eventId',
  authenticate,
  requireAdmin,
  updateMatchEventController,
);
matchEventRouter.delete(
  '/:eventId',
  authenticate,
  requireAdmin,
  deleteMatchEventController,
);

export default matchEventRouter;
