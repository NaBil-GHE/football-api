import { Router } from 'express';
import {
  getLiveMatchesController,
  getOverviewController,
  getRecentResultsController,
  getUpcomingMatchesController,
} from './dashboard.controller';

const dashboardRouter = Router();

dashboardRouter.get('/overview', getOverviewController);
dashboardRouter.get('/live-matches', getLiveMatchesController);
dashboardRouter.get('/upcoming-matches', getUpcomingMatchesController);
dashboardRouter.get('/recent-results', getRecentResultsController);

export default dashboardRouter;
