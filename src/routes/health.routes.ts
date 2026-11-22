import { Router, type NextFunction, type Request, type Response } from 'express';
import { checkDatabaseHealth } from '../config/database';

const healthRouter = Router();

healthRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const database = await checkDatabaseHealth();
    const isHealthy = database.connected;
    const statusCode = isHealthy ? 200 : 503;

    res.status(statusCode).json({
      status: isHealthy ? 'ok' : 'degraded',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      database,
    });
  } catch (error) {
    next(error);
  }
});

export default healthRouter;
