import { Router } from 'express';
import teamRouter from '../modules/teams/team.routes';
import healthRouter from './health.routes';

const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/teams', teamRouter);

export default apiRouter;
