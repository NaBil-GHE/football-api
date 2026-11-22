import 'dotenv/config';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import express from 'express';
import { z } from 'zod';
import app from '../src/app';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { errorHandler } from '../src/middleware/error.middleware';
import { notFoundHandler } from '../src/middleware/not-found.middleware';

async function startTestServer(expressApp: express.Express) {
  return await new Promise<{ baseUrl: string; close: () => Promise<void> }>(
    (resolve) => {
      const server = expressApp.listen(0, '127.0.0.1', () => {
        const address = server.address() as AddressInfo;
        resolve({
          baseUrl: `http://127.0.0.1:${address.port}`,
          close: () =>
            new Promise<void>((res, rej) => {
              server.close((err) => (err ? rej(err) : res()));
            }),
        });
      });
    },
  );
}

describe('Phase 2 — API Foundation', () => {
  let baseUrl = '';
  let closeServer: () => Promise<void>;

  before(async () => {
    const started = await startTestServer(app);
    baseUrl = started.baseUrl;
    closeServer = started.close;
  });

  after(async () => {
    await disconnectDatabase();
    await closeServer();
  });

  it('GET /api/health returns 503 degraded when MongoDB is disconnected', async () => {
    await disconnectDatabase();

    const response = await fetch(`${baseUrl}/api/health`);
    const body = (await response.json()) as {
      status: string;
      uptime: number;
      timestamp: string;
      database: { connected: boolean; state: string };
    };

    assert.equal(response.status, 503);
    assert.equal(body.status, 'degraded');
    assert.equal(body.database.connected, false);
    assert.equal(body.database.state, 'disconnected');
    assert.equal(typeof body.uptime, 'number');
    assert.equal(typeof body.timestamp, 'string');
  });

  it('GET /api/health returns 200 ok when MongoDB is connected', async () => {
    await connectDatabase();

    const response = await fetch(`${baseUrl}/api/health`);
    const body = (await response.json()) as {
      status: string;
      uptime: number;
      timestamp: string;
      database: { connected: boolean; state: string };
    };

    assert.equal(response.status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(body.database.connected, true);
    assert.equal(body.database.state, 'connected');
  });

  it('returns 404 unified JSON for non-existent routes', async () => {
    const response = await fetch(`${baseUrl}/api/non-existent-route`);
    const body = (await response.json()) as {
      success: boolean;
      error: { code: string; message: string };
    };

    assert.equal(response.status, 404);
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'NOT_FOUND');
    assert.match(body.error.message, /\/api\/non-existent-route/);
  });

  it('returns 400 INVALID_JSON for malformed JSON body', async () => {
    const response = await fetch(`${baseUrl}/api/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"broken": ',
    });
    const body = (await response.json()) as {
      success: boolean;
      error: { code: string; message: string };
    };

    assert.equal(response.status, 400);
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'INVALID_JSON');
    assert.equal(body.error.message, 'Invalid JSON payload');
  });

  it('handles unexpected errors and hides stack/details in production', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.get('/boom', () => {
      throw new Error('Sensitive database password leak');
    });
    testApp.post('/validate', (req, _res, next) => {
      const schema = z.object({ name: z.string().min(3) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        next(parsed.error);
        return;
      }
      next();
    });
    testApp.use(notFoundHandler);
    testApp.use(errorHandler);

    const started = await startTestServer(testApp);
    const originalNodeEnv = process.env.NODE_ENV;

    try {
      // 1) Unexpected error in production mode
      process.env.NODE_ENV = 'production';
      const prodRes = await fetch(`${started.baseUrl}/boom`);
      const prodBody = (await prodRes.json()) as {
        success: boolean;
        error: { code: string; message: string; stack?: string };
      };

      assert.equal(prodRes.status, 500);
      assert.equal(prodBody.success, false);
      assert.equal(prodBody.error.code, 'INTERNAL_SERVER_ERROR');
      assert.equal(prodBody.error.message, 'Internal server error');
      assert.equal(prodBody.error.stack, undefined);

      // 2) Unexpected error in development mode includes stack
      process.env.NODE_ENV = 'development';
      const devRes = await fetch(`${started.baseUrl}/boom`);
      const devBody = (await devRes.json()) as {
        success: boolean;
        error: { code: string; message: string; stack?: string };
      };

      assert.equal(devRes.status, 500);
      assert.equal(devBody.success, false);
      assert.equal(devBody.error.code, 'INTERNAL_SERVER_ERROR');
      assert.equal(typeof devBody.error.stack, 'string');

      // 3) Zod validation error returns 400 with field details
      const valRes = await fetch(`${started.baseUrl}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'a' }),
      });
      const valBody = (await valRes.json()) as {
        success: boolean;
        error: {
          code: string;
          message: string;
          details: Array<{ path: string; message: string }>;
        };
      };

      assert.equal(valRes.status, 400);
      assert.equal(valBody.success, false);
      assert.equal(valBody.error.code, 'VALIDATION_ERROR');
      assert.equal(valBody.error.details[0]?.path, 'name');
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      await started.close();
    }
  });
});
