import cors, { type CorsOptions } from 'cors';
import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { errorHandler } from './middleware/error.middleware';
import { notFoundHandler } from './middleware/not-found.middleware';
import apiRouter from './routes';

function buildCorsOptions(): CorsOptions {
  const rawOrigins = process.env.CORS_ORIGIN?.trim();
  if (!rawOrigins || rawOrigins === '*') {
    return { origin: '*' };
  }

  const allowedOrigins = rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    origin: allowedOrigins,
    credentials: true,
  };
}

function securityHeaders(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
}

const app: Express = express();

app.disable('x-powered-by');
app.use(securityHeaders);
app.use(cors(buildCorsOptions()));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api', apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
