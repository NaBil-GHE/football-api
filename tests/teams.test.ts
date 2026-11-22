import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import app from '../src/app';
import {
  clearTestDb,
  setupTestDb,
  startTestServer,
  teardownTestDb,
} from './helpers/test-db';

describe('Phase 3 — Teams Module', () => {
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

  it('creates, fetches, updates, and deletes a team', async () => {
    const createRes = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Real Madrid',
        shortName: 'rma',
        country: 'Spain',
        logo: 'https://example.com/rma.png',
        founded: 1902,
        stadium: 'Santiago Bernabeu',
        description: 'Spanish football club',
      }),
    });

    const created = (await createRes.json()) as {
      success: boolean;
      data: { _id: string; name: string; shortName: string; founded: number };
    };
    assert.equal(createRes.status, 201);
    assert.equal(created.success, true);
    assert.equal(created.data.name, 'Real Madrid');
    assert.equal(created.data.shortName, 'RMA');
    assert.equal(created.data.founded, 1902);

    const teamId = created.data._id;

    const getRes = await fetch(`${baseUrl}/api/teams/${teamId}`);
    const fetched = (await getRes.json()) as {
      success: boolean;
      data: { _id: string; stadium: string };
    };
    assert.equal(getRes.status, 200);
    assert.equal(fetched.data._id, teamId);
    assert.equal(fetched.data.stadium, 'Santiago Bernabeu');

    const patchRes = await fetch(`${baseUrl}/api/teams/${teamId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stadium: 'Bernabeu Renovated' }),
    });
    const updated = (await patchRes.json()) as {
      success: boolean;
      data: { stadium: string };
    };
    assert.equal(patchRes.status, 200);
    assert.equal(updated.data.stadium, 'Bernabeu Renovated');

    const deleteRes = await fetch(`${baseUrl}/api/teams/${teamId}`, {
      method: 'DELETE',
    });
    assert.equal(deleteRes.status, 200);

    const afterDeleteRes = await fetch(`${baseUrl}/api/teams/${teamId}`);
    assert.equal(afterDeleteRes.status, 404);
  });

  it('prevents duplicate teams in the same country (case-insensitive)', async () => {
    await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Barcelona',
        shortName: 'FCB',
        country: 'Spain',
      }),
    });

    const dupRes = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'barcelona',
        shortName: 'BAR',
        country: 'spain',
      }),
    });
    const dupBody = (await dupRes.json()) as {
      success: boolean;
      error: { code: string };
    };
    assert.equal(dupRes.status, 409);
    assert.equal(dupBody.error.code, 'TEAM_ALREADY_EXISTS');
  });

  it('supports pagination, search, country filter, and sorting', async () => {
    const teams = [
      { name: 'Arsenal', shortName: 'ARS', country: 'England', founded: 1886 },
      { name: 'Chelsea', shortName: 'CHE', country: 'England', founded: 1905 },
      { name: 'Liverpool', shortName: 'LIV', country: 'England', founded: 1892 },
      { name: 'Real Madrid', shortName: 'RMA', country: 'Spain', founded: 1902 },
    ];

    for (const team of teams) {
      await fetch(`${baseUrl}/api/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(team),
      });
    }

    const filteredRes = await fetch(
      `${baseUrl}/api/teams?country=england&sort=-founded&page=1&limit=2`,
    );
    const filtered = (await filteredRes.json()) as {
      success: boolean;
      data: Array<{ name: string; founded: number }>;
      pagination: { total: number; totalPages: number; hasNextPage: boolean };
    };

    assert.equal(filteredRes.status, 200);
    assert.equal(filtered.data.length, 2);
    assert.equal(filtered.data[0]?.name, 'Chelsea');
    assert.equal(filtered.data[1]?.name, 'Liverpool');
    assert.equal(filtered.pagination.total, 3);
    assert.equal(filtered.pagination.totalPages, 2);
    assert.equal(filtered.pagination.hasNextPage, true);

    const searchRes = await fetch(`${baseUrl}/api/teams?search=madrid`);
    const searched = (await searchRes.json()) as {
      data: Array<{ name: string }>;
    };
    assert.equal(searchRes.status, 200);
    assert.equal(searched.data.length, 1);
    assert.equal(searched.data[0]?.name, 'Real Madrid');
  });

  it('rejects invalid ObjectId and invalid payloads', async () => {
    const badIdRes = await fetch(`${baseUrl}/api/teams/not-an-object-id`);
    const badIdBody = (await badIdRes.json()) as { error: { code: string } };
    assert.equal(badIdRes.status, 400);
    assert.equal(badIdBody.error.code, 'INVALID_ID');

    const badPayloadRes = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'A', shortName: 'X' }),
    });
    const badPayloadBody = (await badPayloadRes.json()) as {
      error: { code: string };
    };
    assert.equal(badPayloadRes.status, 400);
    assert.equal(badPayloadBody.error.code, 'VALIDATION_ERROR');
  });
});
