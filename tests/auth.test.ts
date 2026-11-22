import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import app from '../src/app';
import {
  clearTestDb,
  createTestAdminHeaders,
  setupTestDb,
  startTestServer,
  teardownTestDb,
} from './helpers/test-db';

describe('Phase 10 — Authentication & Admin Security', () => {
  let baseUrl = '';
  let closeServer: () => Promise<void>;

  before(async () => {
    await setupTestDb();
    const started = await startTestServer(app);
    baseUrl = started.baseUrl;
    closeServer = started.close;
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  after(async () => {
    await closeServer();
    await teardownTestDb();
  });

  it('registers a viewer, logs in, fetches /me, and blocks non-admin mutations', async () => {
    // 1) Register viewer
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Regular Viewer',
        email: 'viewer@example.com',
        password: 'StrongPassword123',
      }),
    });
    const regBody = (await regRes.json()) as {
      success: boolean;
      data: {
        token: string;
        user: { email: string; role: string; passwordHash?: string };
      };
    };
    assert.equal(regRes.status, 201);
    assert.equal(regBody.data.user.role, 'viewer');
    assert.equal(regBody.data.user.passwordHash, undefined);

    // 2) Login
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'viewer@example.com',
        password: 'StrongPassword123',
      }),
    });
    const loginBody = (await loginRes.json()) as {
      data: { token: string };
    };
    assert.equal(loginRes.status, 200);
    assert.equal(typeof loginBody.data.token, 'string');

    // Wrong password rejected
    const badLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'viewer@example.com',
        password: 'WrongPassword',
      }),
    });
    assert.equal(badLoginRes.status, 401);

    // 3) GET /api/auth/me
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${loginBody.data.token}` },
    });
    const meBody = (await meRes.json()) as {
      data: { email: string; role: string };
    };
    assert.equal(meRes.status, 200);
    assert.equal(meBody.data.email, 'viewer@example.com');

    // 4) Unauthenticated mutation -> 401
    const unauthRes = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Unauthorized FC',
        shortName: 'UNA',
        country: 'Spain',
      }),
    });
    assert.equal(unauthRes.status, 401);

    // 5) Viewer mutation -> 403
    const forbiddenRes = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginBody.data.token}`,
      },
      body: JSON.stringify({
        name: 'Viewer FC',
        shortName: 'VWR',
        country: 'Spain',
      }),
    });
    assert.equal(forbiddenRes.status, 403);

    // 6) Admin mutation -> 201
    const adminHeaders = await createTestAdminHeaders();
    const adminRes = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'Admin FC',
        shortName: 'ADM',
        country: 'Spain',
      }),
    });
    assert.equal(adminRes.status, 201);
  });
});
