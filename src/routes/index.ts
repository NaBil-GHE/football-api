import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiSpec } from '../docs/openapi';
import authRouter from '../modules/auth/auth.routes';
import dashboardRouter from '../modules/dashboard/dashboard.routes';
import leagueRouter from '../modules/leagues/league.routes';
import matchRouter from '../modules/matches/match.routes';
import teamRouter from '../modules/teams/team.routes';
import healthRouter from './health.routes';

const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.get('/docs.json', (_req, res) => {
  res.status(200).json(openApiSpec);
});
apiRouter.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

apiRouter.use('/auth', authRouter);
apiRouter.use('/teams', teamRouter);
apiRouter.use('/leagues', leagueRouter);
apiRouter.use('/matches', matchRouter);
apiRouter.use('/dashboard', dashboardRouter);

export default apiRouter;
