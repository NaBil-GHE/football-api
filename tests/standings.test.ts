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

describe('Phase 8 — Standings Module', () => {
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

  it('computes league standings from finished matches only and sorts by Points, GD, GF', async () => {
    const post = async (path: string, payload: unknown) => {
      const res = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      return (await res.json()) as { data: { _id: string } };
    };

    const league = await post('/api/leagues', {
      name: 'Premier League',
      country: 'England',
      type: 'league',
    });
    const season = await post(`/api/leagues/${league.data._id}/seasons`, {
      name: '2025/2026',
      startDate: '2025-08-15T00:00:00.000Z',
      endDate: '2026-05-25T00:00:00.000Z',
      current: true,
    });

    const teamA = await post('/api/teams', { name: 'Alpha FC', shortName: 'ALP', country: 'England' });
    const teamB = await post('/api/teams', { name: 'Beta FC', shortName: 'BET', country: 'England' });
    const teamC = await post('/api/teams', { name: 'Gamma FC', shortName: 'GAM', country: 'England' });

    const kickoff = new Date().toISOString();

    await post('/api/matches', {
      league: league.data._id,
      season: season.data._id,
      homeTeam: teamA.data._id,
      awayTeam: teamB.data._id,
      kickoff,
      status: 'finished',
      homeScore: 3,
      awayScore: 1,
      minute: 90,
    });

    await post('/api/matches', {
      league: league.data._id,
      season: season.data._id,
      homeTeam: teamC.data._id,
      awayTeam: teamB.data._id,
      kickoff,
      status: 'finished',
      homeScore: 2,
      awayScore: 0,
      minute: 90,
    });

    await post('/api/matches', {
      league: league.data._id,
      season: season.data._id,
      homeTeam: teamB.data._id,
      awayTeam: teamA.data._id,
      kickoff,
      status: 'live',
      homeScore: 5,
      awayScore: 0,
      minute: 70,
    });

    const res = await fetch(
      `${baseUrl}/api/leagues/${league.data._id}/standings?season=${season.data._id}`,
    );
    const body = (await res.json()) as {
      success: boolean;
      data: {
        standings: Array<{
          position: number;
          team: { name: string };
          played: number;
          won: number;
          drawn: number;
          lost: number;
          goalsFor: number;
          goalsAgainst: number;
          goalDifference: number;
          points: number;
        }>;
      };
    };

    assert.equal(res.status, 200);
    assert.equal(body.data.standings.length, 3);
    assert.equal(body.data.standings[0]?.team.name, 'Alpha FC');
    assert.equal(body.data.standings[0]?.points, 3);
    assert.equal(body.data.standings[0]?.goalsFor, 3);
    assert.equal(body.data.standings[1]?.team.name, 'Gamma FC');
    assert.equal(body.data.standings[1]?.points, 3);
    assert.equal(body.data.standings[1]?.goalsFor, 2);
    assert.equal(body.data.standings[2]?.team.name, 'Beta FC');
    assert.equal(body.data.standings[2]?.played, 2);
    assert.equal(body.data.standings[2]?.lost, 2);
    assert.equal(body.data.standings[2]?.goalDifference, -4);
  });
});
