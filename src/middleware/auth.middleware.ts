import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/app-error';
import { verifyAccessToken } from '../modules/auth/auth.service';
import type { UserRole } from '../modules/auth/user.model';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(
        'Missing or invalid Authorization header',
        401,
        'UNAUTHORIZED',
      );
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      throw new AppError('Missing authentication token', 401, 'UNAUTHORIZED');
    }

    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    return;
  }

  if (req.user.role !== 'admin') {
    next(
      new AppError(
        'Admin privileges are required to perform this action',
        403,
        'FORBIDDEN',
      ),
    );
    return;
  }

  next();
}
