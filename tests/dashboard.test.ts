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

describe('Phase 9 — Dashboard API', () => {
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

  it('returns accurate overview counts and live/upcoming/recent match lists', async () => {
    const post = async (path: string, payload: unknown) => {
      const res = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      return (await res.json()) as { data: { _id: string } };
    };

    const league = await post('/api/leagues', {
      name: 'Bundesliga',
      country: 'Germany',
      type: 'league',
    });
    const season = await post(`/api/leagues/${league.data._id}/seasons`, {
      name: '2025/2026',
      startDate: '2025-08-15T00:00:00.000Z',
      endDate: '2026-05-25T00:00:00.000Z',
      current: true,
    });
    const bayern = await post('/api/teams', {
      name: 'Bayern Munich',
      shortName: 'FCB',
      country: 'Germany',
    });
    const bvb = await post('/api/teams', {
      name: 'Borussia Dortmund',
      shortName: 'BVB',
      country: 'Germany',
    });

    const now = Date.now();
    await post('/api/matches', {
      league: league.data._id,
      season: season.data._id,
      homeTeam: bayern.data._id,
      awayTeam: bvb.data._id,
      kickoff: new Date(now).toISOString(),
      status: 'live',
      homeScore: 1,
      awayScore: 1,
      minute: 55,
    });
    await post('/api/matches', {
      league: league.data._id,
      season: season.data._id,
      homeTeam: bvb.data._id,
      awayTeam: bayern.data._id,
      kickoff: new Date(now + 24 * 3600_000).toISOString(),
      status: 'scheduled',
    });
    await post('/api/matches', {
      league: league.data._id,
      season: season.data._id,
      homeTeam: bayern.data._id,
      awayTeam: bvb.data._id,
      kickoff: new Date(now - 24 * 3600_000).toISOString(),
      status: 'finished',
      homeScore: 3,
      awayScore: 0,
      minute: 90,
    });

    const [overviewRes, liveRes, upcomingRes, recentRes] = await Promise.all([
      fetch(`${baseUrl}/api/dashboard/overview`),
      fetch(`${baseUrl}/api/dashboard/live-matches`),
      fetch(`${baseUrl}/api/dashboard/upcoming-matches`),
      fetch(`${baseUrl}/api/dashboard/recent-results`),
    ]);

    const overview = (await overviewRes.json()) as {
      data: {
        counts: {
          teams: number;
          leagues: number;
          matches: number;
          liveMatches: number;
          upcomingMatches: number;
          finishedMatches: number;
        };
        liveMatches: unknown[];
        upcomingMatches: unknown[];
        recentResults: unknown[];
      };
    };

    assert.equal(overviewRes.status, 200);
    assert.deepEqual(overview.data.counts, {
      teams: 2,
      leagues: 1,
      matches: 3,
      liveMatches: 1,
      upcomingMatches: 1,
      finishedMatches: 1,
    });
    assert.equal(overview.data.liveMatches.length, 1);
    assert.equal(overview.data.upcomingMatches.length, 1);
    assert.equal(overview.data.recentResults.length, 1);

    assert.equal(((await liveRes.json()) as { data: unknown[] }).data.length, 1);
    assert.equal(((await upcomingRes.json()) as { data: unknown[] }).data.length, 1);
    assert.equal(((await recentRes.json()) as { data: unknown[] }).data.length, 1);
  });
});
