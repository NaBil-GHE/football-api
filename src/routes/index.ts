import { Router } from 'express';
import leagueRouter from '../modules/leagues/league.routes';
import teamRouter from '../modules/teams/team.routes';
import healthRouter from './health.routes';

const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/teams', teamRouter);
apiRouter.use('/leagues', leagueRouter);

export default apiRouter;
