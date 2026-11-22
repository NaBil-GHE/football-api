import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import app from '../src/app';
import {
  clearTestDb,
  setupTestDb,
  startTestServer,
  teardownTestDb,
} from './helpers/test-db';

describe('Phase 4 — Leagues & Seasons Module', () => {
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

  it('creates, reads, updates, and manages seasons for a league', async () => {
    const createRes = await fetch(`${baseUrl}/api/leagues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Premier League',
        country: 'England',
        type: 'league',
        logo: 'https://example.com/epl.png',
      }),
    });

    const created = (await createRes.json()) as {
      success: boolean;
      data: { _id: string; name: string };
    };
    assert.equal(createRes.status, 201);
    const leagueId = created.data._id;

    // Duplicate league prevented
    const dupRes = await fetch(`${baseUrl}/api/leagues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'premier league',
        country: 'england',
        type: 'league',
      }),
    });
    assert.equal(dupRes.status, 409);

    // Create first season (current = true)
    const s1Res = await fetch(`${baseUrl}/api/leagues/${leagueId}/seasons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '2024/2025',
        startDate: '2024-08-15T00:00:00.000Z',
        endDate: '2025-05-25T00:00:00.000Z',
        current: true,
      }),
    });
    assert.equal(s1Res.status, 201);
    const s1 = (await s1Res.json()) as { data: { _id: string } };

    // Create second season (current = true) should unset first season's current flag
    const s2Res = await fetch(`${baseUrl}/api/leagues/${leagueId}/seasons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '2025/2026',
        startDate: '2025-08-15T00:00:00.000Z',
        endDate: '2026-05-25T00:00:00.000Z',
        current: true,
      }),
    });
    assert.equal(s2Res.status, 201);
    const s2 = (await s2Res.json()) as { data: { _id: string } };

    // Duplicate season rejected
    const dupSeasonRes = await fetch(`${baseUrl}/api/leagues/${leagueId}/seasons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '2025/2026',
        startDate: '2025-08-15T00:00:00.000Z',
        endDate: '2026-05-25T00:00:00.000Z',
      }),
    });
    assert.equal(dupSeasonRes.status, 409);

    // Invalid date range rejected
    const badDateRes = await fetch(`${baseUrl}/api/leagues/${leagueId}/seasons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '2026/2027',
        startDate: '2027-05-25T00:00:00.000Z',
        endDate: '2026-08-15T00:00:00.000Z',
      }),
    });
    assert.equal(badDateRes.status, 400);

    // List seasons verifies only 2025/2026 is current
    const seasonsRes = await fetch(`${baseUrl}/api/leagues/${leagueId}/seasons`);
    const seasonsBody = (await seasonsRes.json()) as {
      data: Array<{ name: string; current: boolean }>;
    };
    assert.equal(seasonsRes.status, 200);
    assert.equal(seasonsBody.data.length, 2);
    const currentSeasons = seasonsBody.data.filter((s) => s.current);
    assert.equal(currentSeasons.length, 1);
    assert.equal(currentSeasons[0]?.name, '2025/2026');

    // Cannot delete league while seasons exist
    const blockedDeleteRes = await fetch(`${baseUrl}/api/leagues/${leagueId}`, {
      method: 'DELETE',
    });
    assert.equal(blockedDeleteRes.status, 409);

    // Delete seasons then delete league
    await fetch(`${baseUrl}/api/leagues/${leagueId}/seasons/${s1.data._id}`, {
      method: 'DELETE',
    });
    await fetch(`${baseUrl}/api/leagues/${leagueId}/seasons/${s2.data._id}`, {
      method: 'DELETE',
    });

    const deleteRes = await fetch(`${baseUrl}/api/leagues/${leagueId}`, {
      method: 'DELETE',
    });
    assert.equal(deleteRes.status, 200);
  });

  it('supports search and filtering by country and type', async () => {
    const leagues = [
      { name: 'La Liga', country: 'Spain', type: 'league' },
      { name: 'Copa del Rey', country: 'Spain', type: 'cup' },
      { name: 'Serie A', country: 'Italy', type: 'league' },
    ];
    for (const league of leagues) {
      await fetch(`${baseUrl}/api/leagues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(league),
      });
    }

    const res = await fetch(`${baseUrl}/api/leagues?country=spain&type=cup`);
    const body = (await res.json()) as {
      data: Array<{ name: string }>;
      pagination: { total: number };
    };
    assert.equal(res.status, 200);
    assert.equal(body.pagination.total, 1);
    assert.equal(body.data[0]?.name, 'Copa del Rey');
  });
});
