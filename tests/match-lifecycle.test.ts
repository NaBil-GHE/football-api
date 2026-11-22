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

describe('Phase 7 — Match Lifecycle Management', () => {
  let baseUrl = '';
  let closeServer: () => Promise<void>;
  let headers: Record<string, string> = {};

  before(async () => {
    await setupTestDb();
    const started = await startTestServer(app);
    baseUrl = started.baseUrl;
    closeServer = started.close;
  });

  beforeEach(async () => {
    await clearTestDb();
    headers = await createTestAdminHeaders();
  });

  after(async () => {
    await closeServer();
    await teardownTestDb();
  });

  async function createScheduledMatch() {
    const post = async (path: string, payload: unknown) => {
      const res = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      return (await res.json()) as { data: { _id: string } };
    };

    const league = await post('/api/leagues', {
      name: 'Serie A',
      country: 'Italy',
      type: 'league',
    });
    const season = await post(`/api/leagues/${league.data._id}/seasons`, {
      name: '2025/2026',
      startDate: '2025-08-15T00:00:00.000Z',
      endDate: '2026-05-25T00:00:00.000Z',
      current: true,
    });
    const home = await post('/api/teams', {
      name: 'Inter',
      shortName: 'INT',
      country: 'Italy',
    });
    const away = await post('/api/teams', {
      name: 'Juventus',
      shortName: 'JUV',
      country: 'Italy',
    });
    const match = await post('/api/matches', {
      league: league.data._id,
      season: season.data._id,
      homeTeam: home.data._id,
      awayTeam: away.data._id,
      kickoff: new Date(Date.now() + 3600_000).toISOString(),
    });
    return match.data._id;
  }

  it('transitions through scheduled -> live -> halftime -> live -> finished and rejects invalid transitions', async () => {
    const matchId = await createScheduledMatch();

    const badHt = await fetch(`${baseUrl}/api/matches/${matchId}/halftime`, {
      method: 'POST',
      headers,
    });
    assert.equal(badHt.status, 400);

    const badFinish = await fetch(`${baseUrl}/api/matches/${matchId}/finish`, {
      method: 'POST',
      headers,
    });
    assert.equal(badFinish.status, 400);

    const startRes = await fetch(`${baseUrl}/api/matches/${matchId}/start`, {
      method: 'POST',
      headers,
    });
    const started = (await startRes.json()) as {
      data: { status: string; minute: number };
    };
    assert.equal(startRes.status, 200);
    assert.equal(started.data.status, 'live');
    assert.equal(started.data.minute, 1);

    const minRes = await fetch(`${baseUrl}/api/matches/${matchId}/minute`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ minute: 38 }),
    });
    assert.equal(minRes.status, 200);
    assert.equal(
      ((await minRes.json()) as { data: { minute: number } }).data.minute,
      38,
    );

    const scoreRes = await fetch(`${baseUrl}/api/matches/${matchId}/score`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ homeScore: 2, awayScore: 1 }),
    });
    assert.equal(scoreRes.status, 200);

    const htRes = await fetch(`${baseUrl}/api/matches/${matchId}/halftime`, {
      method: 'POST',
      headers,
    });
    const ht = (await htRes.json()) as {
      data: { status: string; minute: number };
    };
    assert.equal(htRes.status, 200);
    assert.equal(ht.data.status, 'halftime');
    assert.equal(ht.data.minute, 45);

    const resumeRes = await fetch(`${baseUrl}/api/matches/${matchId}/resume`, {
      method: 'POST',
      headers,
    });
    const resumed = (await resumeRes.json()) as {
      data: { status: string; minute: number };
    };
    assert.equal(resumeRes.status, 200);
    assert.equal(resumed.data.status, 'live');
    assert.equal(resumed.data.minute, 46);

    const finishRes = await fetch(`${baseUrl}/api/matches/${matchId}/finish`, {
      method: 'POST',
      headers,
    });
    const finished = (await finishRes.json()) as {
      data: { status: string; minute: number };
    };
    assert.equal(finishRes.status, 200);
    assert.equal(finished.data.status, 'finished');
    assert.equal(finished.data.minute, 90);

    const restartRes = await fetch(`${baseUrl}/api/matches/${matchId}/start`, {
      method: 'POST',
      headers,
    });
    assert.equal(restartRes.status, 400);

    const cancelFinishedRes = await fetch(
      `${baseUrl}/api/matches/${matchId}/cancel`,
      { method: 'POST', headers },
    );
    assert.equal(cancelFinishedRes.status, 400);
  });

  it('supports postpone and cancel transitions', async () => {
    const matchId = await createScheduledMatch();

    const postponeRes = await fetch(
      `${baseUrl}/api/matches/${matchId}/postpone`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          kickoff: new Date(Date.now() + 72 * 3600_000).toISOString(),
        }),
      },
    );
    assert.equal(postponeRes.status, 200);
    assert.equal(
      ((await postponeRes.json()) as { data: { status: string } }).data.status,
      'postponed',
    );

    const cancelRes = await fetch(`${baseUrl}/api/matches/${matchId}/cancel`, {
      method: 'POST',
      headers,
    });
    assert.equal(cancelRes.status, 200);
    assert.equal(
      ((await cancelRes.json()) as { data: { status: string } }).data.status,
      'cancelled',
    );

    const startCancelled = await fetch(`${baseUrl}/api/matches/${matchId}/start`, {
      method: 'POST',
      headers,
    });
    assert.equal(startCancelled.status, 400);
  });
});
