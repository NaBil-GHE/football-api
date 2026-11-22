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

describe('Phase 5 — Matches Module', () => {
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

  async function seedBasics() {
    const create = async (path: string, payload: unknown) => {
      const res = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as { data: { _id: string } };
      return body.data._id;
    };

    const leagueId = await create('/api/leagues', {
      name: 'La Liga',
      country: 'Spain',
      type: 'league',
    });
    const seasonId = await create(`/api/leagues/${leagueId}/seasons`, {
      name: '2025/2026',
      startDate: '2025-08-15T00:00:00.000Z',
      endDate: '2026-05-25T00:00:00.000Z',
      current: true,
    });
    const homeTeamId = await create('/api/teams', {
      name: 'Real Madrid',
      shortName: 'RMA',
      country: 'Spain',
    });
    const awayTeamId = await create('/api/teams', {
      name: 'Barcelona',
      shortName: 'FCB',
      country: 'Spain',
    });

    return { leagueId, seasonId, homeTeamId, awayTeamId };
  }

  it('prevents a team from playing against itself and validates references', async () => {
    const { leagueId, seasonId, homeTeamId } = await seedBasics();

    const sameTeamRes = await fetch(`${baseUrl}/api/matches`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        league: leagueId,
        season: seasonId,
        homeTeam: homeTeamId,
        awayTeam: homeTeamId,
        kickoff: new Date(Date.now() + 3600_000).toISOString(),
      }),
    });
    assert.equal(sameTeamRes.status, 400);

    const missingTeamRes = await fetch(`${baseUrl}/api/matches`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        league: leagueId,
        season: seasonId,
        homeTeam: homeTeamId,
        awayTeam: '507f1f77bcf86cd799439011',
        kickoff: new Date(Date.now() + 3600_000).toISOString(),
      }),
    });
    assert.equal(missingTeamRes.status, 404);
  });

  it('supports match CRUD and today/upcoming/live/finished/team filters', async () => {
    const { leagueId, seasonId, homeTeamId, awayTeamId } = await seedBasics();
    const now = Date.now();

    const createMatch = async (overrides: Record<string, unknown>) => {
      const res = await fetch(`${baseUrl}/api/matches`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          league: leagueId,
          season: seasonId,
          homeTeam: homeTeamId,
          awayTeam: awayTeamId,
          venue: 'Santiago Bernabeu',
          round: 'Matchday 1',
          ...overrides,
        }),
      });
      assert.equal(res.status, 201);
      return (await res.json()) as { data: { _id: string } };
    };

    const liveMatch = await createMatch({
      kickoff: new Date(now).toISOString(),
      status: 'live',
      homeScore: 1,
      awayScore: 0,
      minute: 35,
    });
    await createMatch({
      kickoff: new Date(now + 48 * 3600_000).toISOString(),
      status: 'scheduled',
    });
    await createMatch({
      kickoff: new Date(now - 48 * 3600_000).toISOString(),
      status: 'finished',
      homeScore: 2,
      awayScore: 1,
      minute: 90,
    });

    const [todayRes, upcomingRes, liveRes, finishedRes, teamRes] =
      await Promise.all([
        fetch(`${baseUrl}/api/matches/today`),
        fetch(`${baseUrl}/api/matches/upcoming`),
        fetch(`${baseUrl}/api/matches/live`),
        fetch(`${baseUrl}/api/matches/finished`),
        fetch(`${baseUrl}/api/matches/team/${homeTeamId}`),
      ]);

    const today = (await todayRes.json()) as { pagination: { total: number } };
    const upcoming = (await upcomingRes.json()) as {
      pagination: { total: number };
    };
    const live = (await liveRes.json()) as { pagination: { total: number } };
    const finished = (await finishedRes.json()) as {
      pagination: { total: number };
    };
    const teamMatches = (await teamRes.json()) as {
      pagination: { total: number };
    };

    assert.equal(today.pagination.total, 1);
    assert.equal(upcoming.pagination.total, 1);
    assert.equal(live.pagination.total, 1);
    assert.equal(finished.pagination.total, 1);
    assert.equal(teamMatches.pagination.total, 3);

    const patchRes = await fetch(`${baseUrl}/api/matches/${liveMatch.data._id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ minute: 42 }),
    });
    assert.equal(patchRes.status, 200);
    const patched = (await patchRes.json()) as { data: { minute: number } };
    assert.equal(patched.data.minute, 42);

    const deleteRes = await fetch(
      `${baseUrl}/api/matches/${liveMatch.data._id}`,
      { method: 'DELETE', headers },
    );
    assert.equal(deleteRes.status, 200);
  });
});
