import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import app from '../src/app';
import { stopAllSimulationWorkers } from '../src/modules/matches/match-simulation.service';
import { generateSimulationSchedule } from '../src/modules/matches/simulation-engine';
import {
  clearTestDb,
  createTestAdminHeaders,
  setupTestDb,
  startTestServer,
  teardownTestDb,
} from './helpers/test-db';

describe('Match Simulation Mode', () => {
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
    stopAllSimulationWorkers();
    await clearTestDb();
    headers = await createTestAdminHeaders();
  });

  after(async () => {
    stopAllSimulationWorkers();
    await closeServer();
    await teardownTestDb();
  });

  async function seedFixture(isSimulation: boolean) {
    const post = async (path: string, payload: unknown) => {
      const res = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      assert.equal(res.status, 201, `Expected 201 for ${path}`);
      return (await res.json()) as { data: { _id: string } };
    };

    const league = await post('/api/leagues', {
      name: 'Simulation Cup',
      country: 'International',
      type: 'league',
    });
    const season = await post(`/api/leagues/${league.data._id}/seasons`, {
      name: '2025/2026',
      startDate: '2025-08-01T00:00:00.000Z',
      endDate: '2026-06-01T00:00:00.000Z',
      current: true,
    });
    const home = await post('/api/teams', {
      name: 'Sim Home FC',
      shortName: 'SHM',
      country: 'Spain',
    });
    const away = await post('/api/teams', {
      name: 'Sim Away FC',
      shortName: 'SAW',
      country: 'Spain',
    });

    const match = await post('/api/matches', {
      league: league.data._id,
      season: season.data._id,
      homeTeam: home.data._id,
      awayTeam: away.data._id,
      kickoff: new Date().toISOString(),
      isSimulation,
      ...(isSimulation
        ? {
            simulationSeed: 'deterministic-seed-42',
            simulationSpeed: 10,
            simulationConfig: {
              matchDuration: 90,
              eventFrequency: 8,
              goalProbability: 0.35,
              cardProbability: 0.35,
              substitutionProbability: 0.25,
            },
          }
        : {}),
    });

    return {
      matchId: match.data._id,
      homeTeamId: home.data._id,
      awayTeamId: away.data._id,
    };
  }

  it('generates identical deterministic schedules for the same seed', () => {
    const a = generateSimulationSchedule('seed-123', { eventFrequency: 10 });
    const b = generateSimulationSchedule('seed-123', { eventFrequency: 10 });
    assert.deepEqual(a, b);
    assert.equal(a[0]?.kind, 'kickoff');
    assert.equal(a[a.length - 1]?.kind, 'fulltime');
    assert.ok(a.some((s) => s.kind === 'halftime'));
    assert.ok(a.some((s) => s.kind === 'second_half'));
  });

  it('rejects simulation controls on normal matches and enforces admin auth', async () => {
    const { matchId } = await seedFixture(false);

    const unauth = await fetch(
      `${baseUrl}/api/matches/${matchId}/simulation/start`,
      { method: 'POST' },
    );
    assert.equal(unauth.status, 401);

    const res = await fetch(
      `${baseUrl}/api/matches/${matchId}/simulation/start`,
      { method: 'POST', headers },
    );
    const body = (await res.json()) as { error: { code: string } };
    assert.equal(res.status, 400);
    assert.equal(body.error.code, 'NOT_SIMULATION_MATCH');
  });

  it('runs start, pause, resume, speed change, step-through to fulltime, and reset without duplicating events', async () => {
    const { matchId, homeTeamId, awayTeamId } = await seedFixture(true);

    // 1) Start simulation -> immediately kicks off match
    const startRes = await fetch(
      `${baseUrl}/api/matches/${matchId}/simulation/start`,
      { method: 'POST', headers, body: JSON.stringify({ simulationSpeed: 2 }) },
    );
    const started = (await startRes.json()) as {
      data: {
        simulationStatus: string;
        simulationSpeed: number;
        progress: { executedSteps: number; totalSteps: number };
        match: { status: string };
      };
    };
    assert.equal(startRes.status, 200);
    assert.equal(started.data.simulationStatus, 'running');
    assert.equal(started.data.simulationSpeed, 2);
    assert.equal(started.data.match.status, 'live');
    assert.equal(started.data.progress.executedSteps, 1);

    // 2) Duplicate start rejected
    const dupStart = await fetch(
      `${baseUrl}/api/matches/${matchId}/simulation/start`,
      { method: 'POST', headers },
    );
    assert.equal(dupStart.status, 409);

    // 3) Pause & change speed & resume & pause again
    const pauseRes = await fetch(
      `${baseUrl}/api/matches/${matchId}/simulation/pause`,
      { method: 'POST', headers },
    );
    assert.equal(pauseRes.status, 200);
    assert.equal(
      ((await pauseRes.json()) as { data: { simulationStatus: string } }).data
        .simulationStatus,
      'paused',
    );

    const speedRes = await fetch(
      `${baseUrl}/api/matches/${matchId}/simulation/speed`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ simulationSpeed: 30 }),
      },
    );
    assert.equal(speedRes.status, 200);
    assert.equal(
      ((await speedRes.json()) as { data: { simulationSpeed: number } }).data
        .simulationSpeed,
      30,
    );

    const resumeRes = await fetch(
      `${baseUrl}/api/matches/${matchId}/simulation/resume`,
      { method: 'POST', headers },
    );
    assert.equal(resumeRes.status, 200);

    // Pause before stepping deterministically through all remaining events
    await fetch(`${baseUrl}/api/matches/${matchId}/simulation/pause`, {
      method: 'POST',
      headers,
    });

    const totalSteps = started.data.progress.totalSteps;
    let lastState = started.data;

    for (let i = 0; i < totalSteps; i += 1) {
      if (lastState.simulationStatus === 'completed') break;
      const nextRes = await fetch(
        `${baseUrl}/api/matches/${matchId}/simulation/next`,
        { method: 'POST', headers },
      );
      if (nextRes.status === 400) break;
      assert.equal(nextRes.status, 200);
      lastState = ((await nextRes.json()) as { data: typeof lastState }).data;
    }

    assert.equal(lastState.simulationStatus, 'completed');
    assert.equal(lastState.match.status, 'finished');
    assert.equal(lastState.progress.executedSteps, totalSteps);

    // Verify score matches recorded goal/penalty/own_goal events exactly
    const eventsRes = await fetch(`${baseUrl}/api/matches/${matchId}/events`);
    const eventsBody = (await eventsRes.json()) as {
      data: Array<{ type: string; team: { _id: string } }>;
    };
    const matchRes = await fetch(`${baseUrl}/api/matches/${matchId}`);
    const matchBody = (await matchRes.json()) as {
      data: { homeScore: number; awayScore: number };
    };

    let expectedHome = 0;
    let expectedAway = 0;
    for (const ev of eventsBody.data) {
      if (ev.type === 'goal' || ev.type === 'penalty') {
        if (ev.team._id === homeTeamId) expectedHome += 1;
        else if (ev.team._id === awayTeamId) expectedAway += 1;
      } else if (ev.type === 'own_goal') {
        if (ev.team._id === homeTeamId) expectedAway += 1;
        else if (ev.team._id === awayTeamId) expectedHome += 1;
      }
    }

    assert.equal(matchBody.data.homeScore, expectedHome);
    assert.equal(matchBody.data.awayScore, expectedAway);
    assert.equal(eventsBody.data.length, 8); // exact eventFrequency, no duplicates

    // 4) Reset simulation restores scheduled 0-0 and clears all events
    const resetRes = await fetch(
      `${baseUrl}/api/matches/${matchId}/simulation/reset`,
      { method: 'POST', headers, body: JSON.stringify({}) },
    );
    const resetBody = (await resetRes.json()) as {
      data: {
        simulationStatus: string;
        progress: { executedSteps: number };
        match: { status: string; homeScore: number; awayScore: number; minute: number };
      };
    };
    assert.equal(resetRes.status, 200);
    assert.equal(resetBody.data.simulationStatus, 'idle');
    assert.equal(resetBody.data.progress.executedSteps, 0);
    assert.equal(resetBody.data.match.status, 'scheduled');
    assert.equal(resetBody.data.match.homeScore, 0);
    assert.equal(resetBody.data.match.awayScore, 0);
    assert.equal(resetBody.data.match.minute, 0);

    const afterResetEvents = (await (
      await fetch(`${baseUrl}/api/matches/${matchId}/events`)
    ).json()) as { data: unknown[] };
    assert.equal(afterResetEvents.data.length, 0);
  });
});
