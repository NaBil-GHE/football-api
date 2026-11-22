import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import app from '../src/app';
import {
  getActiveSimulationWorkerCount,
  recoverRunningSimulations,
  stopAllSimulationWorkers,
} from '../src/modules/matches/match-simulation.service';
import { generateSimulationSchedule } from '../src/modules/matches/simulation-engine';
import {
  clearTestDb,
  createTestAdminHeaders,
  setupTestDb,
  startTestServer,
  teardownTestDb,
} from './helpers/test-db';

describe('Match Simulation Mode — Deep Verification', () => {
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

  async function seedFixture(
    isSimulation: boolean,
    simOverrides: Record<string, unknown> = {},
  ) {
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
      name: 'Simulation League',
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
              eventFrequency: 10,
              goalProbability: 0.3,
              cardProbability: 0.35,
              substitutionProbability: 0.3,
              maxSubstitutionsPerTeam: 3,
            },
            ...simOverrides,
          }
        : {}),
    });

    return {
      leagueId: league.data._id,
      seasonId: season.data._id,
      matchId: match.data._id,
      homeTeamId: home.data._id,
      awayTeamId: away.data._id,
    };
  }

  it('enforces determinism, red card player removal, and substitution constraints', () => {
    const config = {
      matchDuration: 90,
      eventFrequency: 28,
      goalProbability: 0.15,
      cardProbability: 0.45,
      substitutionProbability: 0.35,
      maxSubstitutionsPerTeam: 3,
    };

    const a = generateSimulationSchedule('rules-seed-99', config);
    const b = generateSimulationSchedule('rules-seed-99', config);
    assert.deepEqual(a, b);

    const sentOff = { home: new Set<string>(), away: new Set<string>() };
    const subbedOut = { home: new Set<string>(), away: new Set<string>() };
    const subbedIn = { home: new Set<string>(), away: new Set<string>() };
    const subsCount = { home: 0, away: 0 };

    for (const step of a) {
      if (step.kind !== 'event' || !step.teamSide) continue;
      const side = step.teamSide;

      if (step.player) {
        assert.equal(
          sentOff[side].has(step.player),
          false,
          `Sent-off player ${step.player} must not act again`,
        );
        assert.equal(
          subbedOut[side].has(step.player),
          false,
          `Substituted-out player ${step.player} must not act again`,
        );
      }

      if (step.eventType === 'red_card' && step.player) {
        sentOff[side].add(step.player);
      }

      if (step.eventType === 'substitution' && step.playerIn && step.playerOut) {
        assert.equal(
          subbedOut[side].has(step.playerOut),
          false,
          'Player cannot be substituted out twice',
        );
        assert.equal(
          subbedIn[side].has(step.playerIn),
          false,
          'Player cannot be substituted in twice',
        );
        assert.equal(
          subbedOut[side].has(step.playerIn),
          false,
          'Substituted-out player cannot re-enter',
        );
        subbedOut[side].add(step.playerOut);
        subbedIn[side].add(step.playerIn);
        subsCount[side] += 1;
      }
    }

    assert.ok(subsCount.home <= config.maxSubstitutionsPerTeam);
    assert.ok(subsCount.away <= config.maxSubstitutionsPerTeam);
  });

  it('rejects invalid simulation configurations and non-simulation controls', async () => {
    const { leagueId, seasonId, homeTeamId, awayTeamId, matchId } =
      await seedFixture(false);

    // Probabilities sum > 1
    const badProb = await fetch(`${baseUrl}/api/matches`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        league: leagueId,
        season: seasonId,
        homeTeam: homeTeamId,
        awayTeam: awayTeamId,
        kickoff: new Date().toISOString(),
        isSimulation: true,
        simulationConfig: {
          matchDuration: 90,
          eventFrequency: 10,
          goalProbability: 0.5,
          cardProbability: 0.4,
          substitutionProbability: 0.3,
        },
      }),
    });
    assert.equal(badProb.status, 400);

    // Invalid seed characters
    const badSeed = await fetch(`${baseUrl}/api/matches`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        league: leagueId,
        season: seasonId,
        homeTeam: homeTeamId,
        awayTeam: awayTeamId,
        kickoff: new Date().toISOString(),
        isSimulation: true,
        simulationSeed: 'bad seed with spaces!',
      }),
    });
    assert.equal(badSeed.status, 400);

    // Non-simulation match rejected
    const notSim = await fetch(
      `${baseUrl}/api/matches/${matchId}/simulation/start`,
      { method: 'POST', headers },
    );
    assert.equal(notSim.status, 400);
    assert.equal(
      ((await notSim.json()) as { error: { code: string } }).error.code,
      'NOT_SIMULATION_MATCH',
    );
  });

  it('handles concurrent start/next requests, server restart recovery, and blocks editing active simulation config', async () => {
    const { matchId } = await seedFixture(true);

    // Concurrent starts -> exactly one succeeds (200), second returns 409
    const [s1, s2] = await Promise.all([
      fetch(`${baseUrl}/api/matches/${matchId}/simulation/start`, {
        method: 'POST',
        headers,
      }),
      fetch(`${baseUrl}/api/matches/${matchId}/simulation/start`, {
        method: 'POST',
        headers,
      }),
    ]);
    const statuses = [s1.status, s2.status].sort();
    assert.deepEqual(statuses, [200, 409]);

    // Cannot edit simulationConfig while running
    const editBlocked = await fetch(`${baseUrl}/api/matches/${matchId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ simulationSeed: 'new-seed' }),
    });
    assert.equal(editBlocked.status, 409);

    // Simulate server restart: clear in-memory workers, then recover
    stopAllSimulationWorkers();
    assert.equal(getActiveSimulationWorkerCount(), 0);

    const recoveredCount = await recoverRunningSimulations();
    assert.equal(recoveredCount, 1);
    assert.equal(getActiveSimulationWorkerCount(), 1);

    // Pause, then issue 3 concurrent /next calls -> strictly sequential, zero duplicates
    await fetch(`${baseUrl}/api/matches/${matchId}/simulation/pause`, {
      method: 'POST',
      headers,
    });

    const [n1, n2, n3] = await Promise.all([
      fetch(`${baseUrl}/api/matches/${matchId}/simulation/next`, {
        method: 'POST',
        headers,
      }),
      fetch(`${baseUrl}/api/matches/${matchId}/simulation/next`, {
        method: 'POST',
        headers,
      }),
      fetch(`${baseUrl}/api/matches/${matchId}/simulation/next`, {
        method: 'POST',
        headers,
      }),
    ]);
    assert.equal(n1.status, 200);
    assert.equal(n2.status, 200);
    assert.equal(n3.status, 200);

    const stateRes = await fetch(`${baseUrl}/api/matches/${matchId}/simulation`);
    const state = (await stateRes.json()) as {
      data: { progress: { executedSteps: number } };
    };
    // 1 kickoff + 3 next calls = 4 executed steps
    assert.equal(state.data.progress.executedSteps, 4);
  });

  it('excludes stopped simulations from standings and includes completed simulations accurately', async () => {
    const { leagueId, matchId, homeTeamId, awayTeamId } = await seedFixture(true);

    // Start then immediately stop -> status becomes stopped & match cancelled
    await fetch(`${baseUrl}/api/matches/${matchId}/simulation/start`, {
      method: 'POST',
      headers,
    });
    const stopRes = await fetch(
      `${baseUrl}/api/matches/${matchId}/simulation/stop`,
      { method: 'POST', headers },
    );
    const stopped = (await stopRes.json()) as {
      data: { simulationStatus: string; match: { status: string } };
    };
    assert.equal(stopRes.status, 200);
    assert.equal(stopped.data.simulationStatus, 'stopped');
    assert.equal(stopped.data.match.status, 'cancelled');

    // Standings must be empty for a stopped/cancelled simulation
    const standingsWhileStopped = (await (
      await fetch(`${baseUrl}/api/leagues/${leagueId}/standings`)
    ).json()) as { data: { standings: unknown[] } };
    assert.equal(standingsWhileStopped.data.standings.length, 0);

    // Reset and step all the way to fulltime
    await fetch(`${baseUrl}/api/matches/${matchId}/simulation/reset`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });

    let completed = false;
    for (let i = 0; i < 30 && !completed; i += 1) {
      const nextRes = await fetch(
        `${baseUrl}/api/matches/${matchId}/simulation/next`,
        { method: 'POST', headers },
      );
      if (nextRes.status !== 200) break;
      const body = (await nextRes.json()) as {
        data: { simulationStatus: string };
      };
      completed = body.data.simulationStatus === 'completed';
    }
    assert.equal(completed, true);

    // All generated events should be marked isSimulated: true
    const eventsBody = (await (
      await fetch(`${baseUrl}/api/matches/${matchId}/events`)
    ).json()) as {
      data: Array<{ isSimulated: boolean; type: string; team: { _id: string } }>;
    };
    assert.ok(eventsBody.data.length > 0);
    assert.ok(eventsBody.data.every((ev) => ev.isSimulated === true));

    // Verify standings now include both teams with exact goals & points
    const matchBody = (await (
      await fetch(`${baseUrl}/api/matches/${matchId}`)
    ).json()) as {
      data: { homeScore: number; awayScore: number; status: string };
    };
    assert.equal(matchBody.data.status, 'finished');

    const finalStandings = (await (
      await fetch(`${baseUrl}/api/leagues/${leagueId}/standings`)
    ).json()) as {
      data: {
        standings: Array<{
          team: { _id: string };
          played: number;
          goalsFor: number;
          goalsAgainst: number;
          points: number;
        }>;
      };
    };
    assert.equal(finalStandings.data.standings.length, 2);

    const homeRow = finalStandings.data.standings.find(
      (r) => r.team._id === homeTeamId,
    );
    const awayRow = finalStandings.data.standings.find(
      (r) => r.team._id === awayTeamId,
    );
    assert.ok(homeRow && awayRow);
    assert.equal(homeRow.played, 1);
    assert.equal(homeRow.goalsFor, matchBody.data.homeScore);
    assert.equal(homeRow.goalsAgainst, matchBody.data.awayScore);
    assert.equal(awayRow.goalsFor, matchBody.data.awayScore);
    assert.equal(awayRow.goalsAgainst, matchBody.data.homeScore);
  });
});
