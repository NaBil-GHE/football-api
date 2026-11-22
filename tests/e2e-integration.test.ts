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

describe('Phase 13 — Full End-to-End Integration Coverage', () => {
  let baseUrl = '';
  let closeServer: () => Promise<void>;
  let adminHeaders: Record<string, string> = {};

  before(async () => {
    await setupTestDb();
    const started = await startTestServer(app);
    baseUrl = started.baseUrl;
    closeServer = started.close;
  });

  beforeEach(async () => {
    await clearTestDb();
    adminHeaders = await createTestAdminHeaders();
  });

  after(async () => {
    await closeServer();
    await teardownTestDb();
  });

  it('runs a complete football matchday workflow from creation to live events, finish, standings, and dashboard', async () => {
    const post = async (path: string, payload?: unknown) => {
      const res = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: adminHeaders,
        ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
      });
      return { res, body: (await res.json()) as Record<string, any> };
    };

    // 1. Setup league, season, teams
    const league = await post('/api/leagues', {
      name: 'Botola Pro',
      country: 'Morocco',
      type: 'league',
    });
    assert.equal(league.res.status, 201);
    const leagueId = league.body.data._id as string;

    const season = await post(`/api/leagues/${leagueId}/seasons`, {
      name: '2025/2026',
      startDate: '2025-08-20T00:00:00.000Z',
      endDate: '2026-05-30T00:00:00.000Z',
      current: true,
    });
    assert.equal(season.res.status, 201);
    const seasonId = season.body.data._id as string;

    const wydad = await post('/api/teams', {
      name: 'Wydad AC',
      shortName: 'WAC',
      country: 'Morocco',
    });
    const raja = await post('/api/teams', {
      name: 'Raja CA',
      shortName: 'RCA',
      country: 'Morocco',
    });
    const homeId = wydad.body.data._id as string;
    const awayId = raja.body.data._id as string;

    // 2. Schedule match
    const match = await post('/api/matches', {
      league: leagueId,
      season: seasonId,
      homeTeam: homeId,
      awayTeam: awayId,
      kickoff: new Date().toISOString(),
      venue: 'Stade Mohammed V',
      round: 'Matchday 1',
    });
    assert.equal(match.res.status, 201);
    const matchId = match.body.data._id as string;

    // 3. Lifecycle: start -> goal -> halftime -> resume -> away penalty -> finish
    assert.equal((await post(`/api/matches/${matchId}/start`)).res.status, 200);

    const goal = await post(`/api/matches/${matchId}/events`, {
      team: homeId,
      type: 'goal',
      minute: 24,
      player: 'Striker 9',
    });
    assert.equal(goal.res.status, 201);
    assert.deepEqual(goal.body.score, { homeScore: 1, awayScore: 0 });

    assert.equal((await post(`/api/matches/${matchId}/halftime`)).res.status, 200);
    assert.equal((await post(`/api/matches/${matchId}/resume`)).res.status, 200);

    const pen = await post(`/api/matches/${matchId}/events`, {
      team: awayId,
      type: 'penalty',
      minute: 78,
      player: 'Captain 10',
    });
    assert.equal(pen.res.status, 201);
    assert.deepEqual(pen.body.score, { homeScore: 1, awayScore: 1 });

    const finish = await post(`/api/matches/${matchId}/finish`);
    assert.equal(finish.res.status, 200);
    assert.equal(finish.body.data.status, 'finished');

    // 4. Standings reflect 1-1 draw (1 point each)
    const standingsRes = await fetch(`${baseUrl}/api/leagues/${leagueId}/standings`);
    const standingsBody = (await standingsRes.json()) as {
      data: { standings: Array<{ team: { shortName: string }; points: number; drawn: number }> };
    };
    assert.equal(standingsRes.status, 200);
    assert.equal(standingsBody.data.standings.length, 2);
    assert.equal(standingsBody.data.standings[0]?.points, 1);
    assert.equal(standingsBody.data.standings[1]?.points, 1);

    // 5. Update finished match score -> standings dynamically recalculate
    const scorePatch = await fetch(`${baseUrl}/api/matches/${matchId}/score`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ homeScore: 2, awayScore: 1 }),
    });
    assert.equal(scorePatch.status, 200);

    const updatedStandingsRes = await fetch(
      `${baseUrl}/api/leagues/${leagueId}/standings`,
    );
    const updatedStandings = (await updatedStandingsRes.json()) as {
      data: { standings: Array<{ team: { shortName: string }; points: number; won: number }> };
    };
    assert.equal(updatedStandings.data.standings[0]?.team.shortName, 'WAC');
    assert.equal(updatedStandings.data.standings[0]?.points, 3);
    assert.equal(updatedStandings.data.standings[1]?.points, 0);

    // 6. Dashboard reflects finished result
    const overviewRes = await fetch(`${baseUrl}/api/dashboard/overview`);
    const overview = (await overviewRes.json()) as {
      data: { counts: { teams: number; leagues: number; finishedMatches: number } };
    };
    assert.equal(overview.data.counts.teams, 2);
    assert.equal(overview.data.counts.leagues, 1);
    assert.equal(overview.data.counts.finishedMatches, 1);
  });

  it('enforces auth, invalid ObjectId, and 404 handling across modules', async () => {
    // Register viewer
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Viewer User',
        email: 'viewer-e2e@example.com',
        password: 'ViewerPassword123',
      }),
    });
    const regBody = (await regRes.json()) as { data: { token: string } };
    const viewerHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${regBody.data.token}`,
    };

    // Viewer blocked from creating league & match (403)
    const leagueForbidden = await fetch(`${baseUrl}/api/leagues`, {
      method: 'POST',
      headers: viewerHeaders,
      body: JSON.stringify({ name: 'Test', country: 'Spain', type: 'league' }),
    });
    assert.equal(leagueForbidden.status, 403);

    const matchForbidden = await fetch(`${baseUrl}/api/matches`, {
      method: 'POST',
      headers: viewerHeaders,
      body: JSON.stringify({}),
    });
    assert.equal(matchForbidden.status, 403);

    // Invalid JWT rejected (401)
    const badJwt = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: 'Bearer invalid.jwt.token' },
    });
    assert.equal(badJwt.status, 401);

    // Invalid ObjectIds return 400
    for (const path of [
      '/api/teams/bad-id',
      '/api/leagues/bad-id',
      '/api/leagues/bad-id/standings',
      '/api/matches/bad-id',
      '/api/matches/bad-id/events',
    ]) {
      const res = await fetch(`${baseUrl}${path}`);
      assert.equal(res.status, 400, `Expected 400 for ${path}`);
    }

    // Valid ObjectIds that do not exist return 404
    const fakeId = '507f1f77bcf86cd799439011';
    for (const path of [
      `/api/teams/${fakeId}`,
      `/api/leagues/${fakeId}`,
      `/api/leagues/${fakeId}/standings`,
      `/api/matches/${fakeId}`,
      `/api/matches/${fakeId}/events`,
    ]) {
      const res = await fetch(`${baseUrl}${path}`);
      assert.equal(res.status, 404, `Expected 404 for ${path}`);
    }
  });
});
