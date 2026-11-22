import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import app from '../src/app';
import { MatchEventModel } from '../src/modules/match-events/match-event.model';
import {
  clearTestDb,
  createTestAdminHeaders,
  setupTestDb,
  startTestServer,
  teardownTestDb,
} from './helpers/test-db';

describe('Phase 11 — Data Integrity & Referential Protection', () => {
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

  it('prevents deleting referenced teams/seasons and cascades match events on match delete', async () => {
    const post = async (path: string, payload: unknown) => {
      const res = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      return (await res.json()) as { data: { _id: string } };
    };

    const league = await post('/api/leagues', {
      name: 'Ligue 1',
      country: 'France',
      type: 'league',
    });
    const season = await post(`/api/leagues/${league.data._id}/seasons`, {
      name: '2025/2026',
      startDate: '2025-08-15T00:00:00.000Z',
      endDate: '2026-05-25T00:00:00.000Z',
      current: true,
    });
    const home = await post('/api/teams', {
      name: 'PSG',
      shortName: 'PSG',
      country: 'France',
    });
    const away = await post('/api/teams', {
      name: 'Marseille',
      shortName: 'OM',
      country: 'France',
    });
    const match = await post('/api/matches', {
      league: league.data._id,
      season: season.data._id,
      homeTeam: home.data._id,
      awayTeam: away.data._id,
      kickoff: new Date().toISOString(),
      status: 'live',
    });

    await post(`/api/matches/${match.data._id}/events`, {
      team: home.data._id,
      type: 'goal',
      minute: 22,
      player: 'Dembele',
    });

    // Cannot delete referenced team
    const delTeamRes = await fetch(`${baseUrl}/api/teams/${home.data._id}`, {
      method: 'DELETE',
      headers,
    });
    assert.equal(delTeamRes.status, 409);

    // Cannot delete referenced season
    const delSeasonRes = await fetch(
      `${baseUrl}/api/leagues/${league.data._id}/seasons/${season.data._id}`,
      { method: 'DELETE', headers },
    );
    assert.equal(delSeasonRes.status, 409);

    // Deleting match atomically removes its events
    const delMatchRes = await fetch(`${baseUrl}/api/matches/${match.data._id}`, {
      method: 'DELETE',
      headers,
    });
    assert.equal(delMatchRes.status, 200);

    const remainingEvents = await MatchEventModel.countDocuments({
      match: match.data._id,
    });
    assert.equal(remainingEvents, 0);

    // Now season and teams can be deleted cleanly
    const delSeasonOk = await fetch(
      `${baseUrl}/api/leagues/${league.data._id}/seasons/${season.data._id}`,
      { method: 'DELETE', headers },
    );
    assert.equal(delSeasonOk.status, 200);

    const delTeamOk = await fetch(`${baseUrl}/api/teams/${home.data._id}`, {
      method: 'DELETE',
      headers,
    });
    assert.equal(delTeamOk.status, 200);
  });
});
