import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import app from '../src/app';
import {
  clearTestDb,
  setupTestDb,
  startTestServer,
  teardownTestDb,
} from './helpers/test-db';

describe('Phase 6 — Match Events Module', () => {
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

  async function seedMatch() {
    const post = async (path: string, payload: unknown) => {
      const res = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return (await res.json()) as { data: { _id: string } };
    };

    const league = await post('/api/leagues', {
      name: 'Champions League',
      country: 'Europe',
      type: 'tournament',
    });
    const season = await post(`/api/leagues/${league.data._id}/seasons`, {
      name: '2025/2026',
      startDate: '2025-09-01T00:00:00.000Z',
      endDate: '2026-06-01T00:00:00.000Z',
      current: true,
    });
    const homeTeam = await post('/api/teams', {
      name: 'Real Madrid',
      shortName: 'RMA',
      country: 'Spain',
    });
    const awayTeam = await post('/api/teams', {
      name: 'Bayern Munich',
      shortName: 'BAY',
      country: 'Germany',
    });
    const thirdTeam = await post('/api/teams', {
      name: 'Milan',
      shortName: 'ACM',
      country: 'Italy',
    });
    const match = await post('/api/matches', {
      league: league.data._id,
      season: season.data._id,
      homeTeam: homeTeam.data._id,
      awayTeam: awayTeam.data._id,
      kickoff: new Date().toISOString(),
      status: 'live',
    });

    return {
      matchId: match.data._id,
      homeTeamId: homeTeam.data._id,
      awayTeamId: awayTeam.data._id,
      thirdTeamId: thirdTeam.data._id,
    };
  }

  it('tracks goals, penalties, own goals, and non-goal events with accurate score calculation', async () => {
    const { matchId, homeTeamId, awayTeamId, thirdTeamId } = await seedMatch();

    // Reject team not in match
    const badTeamRes = await fetch(`${baseUrl}/api/matches/${matchId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        team: thirdTeamId,
        type: 'goal',
        minute: 10,
        player: 'Outsider',
      }),
    });
    assert.equal(badTeamRes.status, 400);

    // 1) Home goal at 45+2 -> 1-0
    const goal1Res = await fetch(`${baseUrl}/api/matches/${matchId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        team: homeTeamId,
        type: 'goal',
        minute: 45,
        addedTime: 2,
        player: 'Vinicius Jr',
      }),
    });
    const goal1 = (await goal1Res.json()) as {
      data: { _id: string };
      score: { homeScore: number; awayScore: number };
    };
    assert.equal(goal1Res.status, 201);
    assert.deepEqual(goal1.score, { homeScore: 1, awayScore: 0 });

    // 2) Away penalty at 15 -> 1-1
    const penRes = await fetch(`${baseUrl}/api/matches/${matchId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        team: awayTeamId,
        type: 'penalty',
        minute: 15,
        player: 'Harry Kane',
      }),
    });
    const pen = (await penRes.json()) as {
      data: { _id: string };
      score: { homeScore: number; awayScore: number };
    };
    assert.equal(penRes.status, 201);
    assert.deepEqual(pen.score, { homeScore: 1, awayScore: 1 });

    // 3) Home own_goal at 60 -> awards goal to away team -> 1-2
    const ogRes = await fetch(`${baseUrl}/api/matches/${matchId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        team: homeTeamId,
        type: 'own_goal',
        minute: 60,
        player: 'Defender',
      }),
    });
    const og = (await ogRes.json()) as {
      data: { _id: string };
      score: { homeScore: number; awayScore: number };
    };
    assert.equal(ogRes.status, 201);
    assert.deepEqual(og.score, { homeScore: 1, awayScore: 2 });

    // 4) Yellow card & substitution do NOT change score
    const ycRes = await fetch(`${baseUrl}/api/matches/${matchId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        team: awayTeamId,
        type: 'yellow_card',
        minute: 45,
        addedTime: 1,
        player: 'Kimmich',
      }),
    });
    const yc = (await ycRes.json()) as {
      score: { homeScore: number; awayScore: number };
    };
    assert.equal(ycRes.status, 201);
    assert.deepEqual(yc.score, { homeScore: 1, awayScore: 2 });

    const subRes = await fetch(`${baseUrl}/api/matches/${matchId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        team: homeTeamId,
        type: 'substitution',
        minute: 70,
        playerIn: 'Modric',
        playerOut: 'Camavinga',
      }),
    });
    assert.equal(subRes.status, 201);

    // List events ordered by minute + addedTime: 15, 45+1, 45+2, 60, 70
    const listRes = await fetch(`${baseUrl}/api/matches/${matchId}/events`);
    const listBody = (await listRes.json()) as {
      data: Array<{ minute: number; addedTime: number }>;
    };
    assert.equal(listRes.status, 200);
    assert.deepEqual(
      listBody.data.map((e) => `${e.minute}+${e.addedTime}`),
      ['15+0', '45+1', '45+2', '60+0', '70+0'],
    );

    // Update own_goal to VAR (disallowed) -> score reverts to 1-1
    const patchRes = await fetch(
      `${baseUrl}/api/matches/${matchId}/events/${og.data._id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'var', description: 'Goal disallowed by VAR' }),
      },
    );
    const patched = (await patchRes.json()) as {
      score: { homeScore: number; awayScore: number };
    };
    assert.equal(patchRes.status, 200);
    assert.deepEqual(patched.score, { homeScore: 1, awayScore: 1 });

    // Delete penalty event -> score becomes 1-0
    const delRes = await fetch(
      `${baseUrl}/api/matches/${matchId}/events/${pen.data._id}`,
      { method: 'DELETE' },
    );
    const deleted = (await delRes.json()) as {
      score: { homeScore: number; awayScore: number };
    };
    assert.equal(delRes.status, 200);
    assert.deepEqual(deleted.score, { homeScore: 1, awayScore: 0 });
  });
});
