import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { AppError } from '../utils/app-error';

interface ErrorPayload {
  code: string;
  message: string;
  details?: unknown;
  stack?: string;
}

interface ExpressHttpError extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
  body?: unknown;
}

function isJsonSyntaxError(err: unknown): err is SyntaxError & ExpressHttpError {
  return (
    err instanceof SyntaxError &&
    typeof (err as ExpressHttpError).status === 'number' &&
    (err as ExpressHttpError).status === 400 &&
    'body' in err
  );
}

function isMongoDuplicateKeyError(
  err: unknown,
): err is { code: number; keyValue?: Record<string, unknown> } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 11000
  );
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const isProduction = process.env.NODE_ENV === 'production';

  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'Internal server error';
  let details: unknown;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (isJsonSyntaxError(err)) {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Invalid JSON payload';
  } else if (err instanceof ZodError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
  } else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Database validation failed';
    details = Object.values(err.errors).map((fieldError) => ({
      path: fieldError.path,
      message: fieldError.message,
    }));
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    code = 'INVALID_ID';
    message = `Invalid value for field "${err.path}"`;
  } else if (isMongoDuplicateKeyError(err)) {
    statusCode = 409;
    code = 'DUPLICATE_KEY';
    message = 'A resource with the same unique value already exists';
    if (!isProduction && err.keyValue) {
      details = err.keyValue;
    }
  } else if (
    err instanceof Error &&
    typeof (err as ExpressHttpError).status === 'number' &&
    ((err as ExpressHttpError).status as number) >= 400 &&
    ((err as ExpressHttpError).status as number) < 500
  ) {
    statusCode = (err as ExpressHttpError).status as number;
    code = 'BAD_REQUEST';
    message = err.message || 'Bad request';
  } else if (err instanceof Error) {
    if (!isProduction) {
      message = err.message || 'Internal server error';
    }
  }

  if (statusCode >= 500) {
    console.error('[Error]', err);
  }

  const errorBody: ErrorPayload = {
    code,
    message,
  };

  if (details !== undefined) {
    errorBody.details = details;
  }

  if (!isProduction && err instanceof Error && err.stack) {
    errorBody.stack = err.stack;
  }

  res.status(statusCode).json({
    success: false,
    error: errorBody,
  });
}
