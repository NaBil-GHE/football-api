import { AppError } from '../../utils/app-error';
import { runInTransaction } from '../../utils/transaction';
import { assertValidObjectId } from '../../utils/validation';
import { MatchEventModel } from '../match-events/match-event.model';
import { createMatchEvent } from '../match-events/match-event.service';
import {
  cancelMatch,
  finishMatch,
  resumeMatch,
  setHalftime,
  startMatch,
  updateMatchMinute,
} from './match-lifecycle.service';
import {
  MatchModel,
  type ISimulationConfig,
  type ISimulationStep,
  type MatchDocument,
  type SimulationStatus,
} from './match.model';
import type {
  ResetSimulationInput,
  StartSimulationInput,
} from './match.schema';
import { MATCH_POPULATE } from './match.service';
import {
  generateSimulationSchedule,
  normalizeSimulationConfig,
} from './simulation-engine';

const activeWorkers = new Map<string, NodeJS.Timeout>();
const matchLocks = new Map<string, Promise<void>>();

export interface SimulationStateView {
  matchId: string;
  isSimulation: boolean;
  simulationStatus: SimulationStatus;
  simulationSpeed: number;
  simulationSeed: string | null;
  simulationStartedAt: Date | null;
  simulationElapsedSeconds: number;
  simulationConfig: ISimulationConfig;
  progress: {
    executedSteps: number;
    totalSteps: number;
    nextStep: {
      stepId: string;
      kind: ISimulationStep['kind'];
      minute: number;
      addedTime: number;
      eventType?: ISimulationStep['eventType'];
      description?: string;
    } | null;
  };
  match: MatchDocument;
}

/**
 * Serializes concurrent simulation operations for the same match
 * to prevent race conditions, duplicate workers, and duplicate events.
 */
async function withMatchLock<T>(
  matchId: string,
  task: () => Promise<T>,
): Promise<T> {
  const previous = matchLocks.get(matchId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = previous.then(() => current);
  matchLocks.set(matchId, chained);

  await previous;
  try {
    return await task();
  } finally {
    release();
    if (matchLocks.get(matchId) === chained) {
      matchLocks.delete(matchId);
    }
  }
}

export function stopSimulationWorker(matchId: string): void {
  const timer = activeWorkers.get(matchId);
  if (timer) {
    clearTimeout(timer);
    activeWorkers.delete(matchId);
  }
}

export function stopAllSimulationWorkers(): void {
  for (const timer of activeWorkers.values()) {
    clearTimeout(timer);
  }
  activeWorkers.clear();
}

export function getActiveSimulationWorkerCount(): number {
  return activeWorkers.size;
}

async function getSimulationMatchOrThrow(matchId: string): Promise<MatchDocument> {
  assertValidObjectId(matchId, 'match id');
  const match = await MatchModel.findById(matchId).select('+simulationSchedule');
  if (!match) {
    throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
  }
  if (!match.isSimulation) {
    throw new AppError(
      'Simulation controls are only available for simulation matches',
      400,
      'NOT_SIMULATION_MATCH',
    );
  }
  return match;
}

async function buildSimulationView(matchId: string): Promise<SimulationStateView> {
  const match = await MatchModel.findById(matchId)
    .select('+simulationSchedule')
    .populate(MATCH_POPULATE);

  if (!match) {
    throw new AppError('Match not found', 404, 'MATCH_NOT_FOUND');
  }

  const schedule = match.simulationSchedule ?? [];
  const executedSteps = schedule.filter((s) => s.executed).length;
  const next = schedule.find((s) => !s.executed) ?? null;

  const matchObj = match.toObject();
  delete (matchObj as { simulationSchedule?: unknown }).simulationSchedule;

  return {
    matchId: match._id.toString(),
    isSimulation: match.isSimulation,
    simulationStatus: match.simulationStatus,
    simulationSpeed: match.simulationSpeed,
    simulationSeed: match.simulationSeed ?? null,
    simulationStartedAt: match.simulationStartedAt ?? null,
    simulationElapsedSeconds: match.simulationElapsedSeconds,
    simulationConfig: normalizeSimulationConfig(match.simulationConfig),
    progress: {
      executedSteps,
      totalSteps: schedule.length,
      nextStep: next
        ? {
            stepId: next.stepId,
            kind: next.kind,
            minute: next.minute,
            addedTime: next.addedTime,
            ...(next.eventType ? { eventType: next.eventType } : {}),
            ...(next.description ? { description: next.description } : {}),
          }
        : null,
    },
    match: matchObj as unknown as MatchDocument,
  };
}

/**
 * Executes the next unexecuted step in the persisted schedule idempotently,
 * delegating strictly to existing lifecycle and match-event services.
 */
async function executeNextStepInternal(matchId: string): Promise<{
  executed: boolean;
  completed: boolean;
}> {
  const match = await MatchModel.findById(matchId).select('+simulationSchedule');
  if (!match || !match.isSimulation) {
    stopSimulationWorker(matchId);
    return { executed: false, completed: true };
  }

  if (match.status === 'finished' || match.status === 'cancelled') {
    const nextSimStatus: SimulationStatus =
      match.status === 'finished' ? 'completed' : 'stopped';
    if (match.simulationStatus !== nextSimStatus) {
      await MatchModel.updateOne(
        { _id: match._id },
        { $set: { simulationStatus: nextSimStatus } },
      );
    }
    stopSimulationWorker(matchId);
    return { executed: false, completed: true };
  }

  const nextIndex = match.simulationSchedule.findIndex((s) => !s.executed);
  if (nextIndex === -1) {
    await MatchModel.updateOne(
      { _id: match._id },
      { $set: { simulationStatus: 'completed' } },
    );
    stopSimulationWorker(matchId);
    return { executed: false, completed: true };
  }

  const step = match.simulationSchedule[nextIndex];
  if (!step) {
    return { executed: false, completed: true };
  }

  const prevMinute = match.minute;
  const targetMinute = Math.max(prevMinute, step.minute);
  let createdEventId: MatchDocument['_id'] | undefined;

  if (step.kind === 'kickoff') {
    if (match.status === 'scheduled' || match.status === 'postponed') {
      await startMatch(matchId);
    }
  } else if (step.kind === 'halftime') {
    if (match.status === 'live') {
      await setHalftime(matchId);
    }
  } else if (step.kind === 'second_half') {
    if (match.status === 'halftime') {
      await resumeMatch(matchId);
    }
  } else if (step.kind === 'fulltime') {
    if (match.status === 'live' || match.status === 'halftime') {
      await finishMatch(matchId);
    }
  } else if (step.kind === 'event' && step.eventType && step.teamSide) {
    const teamId =
      step.teamSide === 'home'
        ? match.homeTeam.toString()
        : match.awayTeam.toString();

    if (match.status === 'live' || match.status === 'halftime') {
      await updateMatchMinute(matchId, targetMinute);
    }

    const result = await createMatchEvent(
      matchId,
      {
        team: teamId,
        type: step.eventType,
        minute: step.minute,
        addedTime: step.addedTime,
        ...(step.player ? { player: step.player } : {}),
        ...(step.playerIn ? { playerIn: step.playerIn } : {}),
        ...(step.playerOut ? { playerOut: step.playerOut } : {}),
        ...(step.description ? { description: step.description } : {}),
      },
      {
        isSimulated: true,
        simulationStepId: step.stepId,
      },
    );
    createdEventId = result.event._id;
  }

  const deltaMinutes = Math.max(1, targetMinute - prevMinute);
  const isLastStep = nextIndex >= match.simulationSchedule.length - 1;

  const updateSet: Record<string, unknown> = {
    [`simulationSchedule.${nextIndex}.executed`]: true,
  };
  if (createdEventId) {
    updateSet[`simulationSchedule.${nextIndex}.executedEventId`] = createdEventId;
  }
  if (isLastStep) {
    updateSet.simulationStatus = 'completed';
  }

  await MatchModel.updateOne(
    { _id: match._id },
    {
      $set: updateSet,
      $inc: { simulationElapsedSeconds: deltaMinutes * 60 },
    },
  );

  if (isLastStep) {
    stopSimulationWorker(matchId);
  }

  return { executed: true, completed: isLastStep };
}

function computeStepDelayMs(
  currentMinute: number,
  nextStep: ISimulationStep | undefined,
  speed: number,
): number {
  const safeSpeed = Math.max(1, Math.min(120, speed));
  const deltaMinutes = nextStep
    ? Math.max(1, nextStep.minute - currentMinute)
    : 1;

  // At 1x speed: 1 match minute = 60s real time (capped at 15s per step for responsiveness).
  // At 10x speed: 1 match minute = 6s. At 60x speed: 1 match minute = 1s.
  const rawDelay = Math.round((deltaMinutes * 60_000) / safeSpeed);
  return Math.max(150, Math.min(15_000, rawDelay));
}

function scheduleNextTick(
  matchId: string,
  currentMinute: number,
  nextStep: ISimulationStep | undefined,
  speed: number,
): void {
  stopSimulationWorker(matchId);

  const delayMs = computeStepDelayMs(currentMinute, nextStep, speed);

  const timer = setTimeout(() => {
    void withMatchLock(matchId, async () => {
      try {
        const match = await MatchModel.findById(matchId).select(
          '+simulationSchedule',
        );
        if (
          !match ||
          !match.isSimulation ||
          match.simulationStatus !== 'running'
        ) {
          stopSimulationWorker(matchId);
          return;
        }

        const { completed } = await executeNextStepInternal(matchId);
        if (!completed) {
          const refreshed = await MatchModel.findById(matchId).select(
            '+simulationSchedule',
          );
          if (refreshed && refreshed.simulationStatus === 'running') {
            const upcoming = refreshed.simulationSchedule.find(
              (s) => !s.executed,
            );
            scheduleNextTick(
              matchId,
              refreshed.minute,
              upcoming,
              refreshed.simulationSpeed,
            );
          } else {
            stopSimulationWorker(matchId);
          }
        }
      } catch (error) {
        console.error(`[Simulation] Worker error for match ${matchId}:`, error);
        stopSimulationWorker(matchId);
      }
    });
  }, delayMs);

  timer.unref();
  activeWorkers.set(matchId, timer);
}

/**
 * Re-attaches workers for any simulations persisted as `running` before a server restart.
 * Safe and idempotent because already-executed steps are marked in MongoDB and
 * `MatchEvent` enforces a unique index on `(match, simulationStepId)`.
 */
export async function recoverRunningSimulations(): Promise<number> {
  const runningMatches = await MatchModel.find({
    isSimulation: true,
    simulationStatus: 'running',
  }).select('+simulationSchedule');

  let recovered = 0;
  for (const match of runningMatches) {
    const matchId = match._id.toString();
    if (match.status === 'finished' || match.status === 'cancelled') {
      await MatchModel.updateOne(
        { _id: match._id },
        {
          $set: {
            simulationStatus:
              match.status === 'finished' ? 'completed' : 'stopped',
          },
        },
      );
      continue;
    }

    const nextStep = match.simulationSchedule.find((s) => !s.executed);
    if (!nextStep) {
      await MatchModel.updateOne(
        { _id: match._id },
        { $set: { simulationStatus: 'completed' } },
      );
      continue;
    }

    scheduleNextTick(matchId, match.minute, nextStep, match.simulationSpeed);
    recovered += 1;
  }

  if (recovered > 0) {
    console.log(`[Simulation] Recovered ${recovered} running simulation(s).`);
  }

  return recovered;
}

export async function getSimulationState(
  matchId: string,
): Promise<SimulationStateView> {
  await getSimulationMatchOrThrow(matchId);
  return await buildSimulationView(matchId);
}

export async function startSimulation(
  matchId: string,
  input: StartSimulationInput = {},
): Promise<SimulationStateView> {
  return await withMatchLock(matchId, async () => {
    const match = await getSimulationMatchOrThrow(matchId);

    if (match.simulationStatus === 'running') {
      throw new AppError(
        'Simulation is already running for this match',
        409,
        'SIMULATION_ALREADY_RUNNING',
      );
    }

    if (
      match.simulationStatus === 'completed' ||
      match.simulationStatus === 'stopped' ||
      match.status === 'finished' ||
      match.status === 'cancelled'
    ) {
      throw new AppError(
        'Cannot start a completed, stopped, finished, or cancelled match simulation. Reset it first.',
        400,
        'INVALID_SIMULATION_STATE',
      );
    }

    if (input.simulationSpeed !== undefined) {
      match.simulationSpeed = input.simulationSpeed;
    }

    if (input.simulationSeed !== undefined) {
      match.simulationSeed = input.simulationSeed;
    } else if (!match.simulationSeed) {
      match.simulationSeed = `sim-${match._id.toString()}`;
    }

    const config = normalizeSimulationConfig(
      input.simulationConfig ?? match.simulationConfig,
    );
    match.simulationConfig = config;

    if (!match.simulationSchedule || match.simulationSchedule.length === 0) {
      match.simulationSchedule = generateSimulationSchedule(
        match.simulationSeed,
        config,
      );
    }

    match.simulationStatus = 'running';
    if (!match.simulationStartedAt) {
      match.simulationStartedAt = new Date();
    }
    await match.save();

    if (match.status === 'scheduled' || match.status === 'postponed') {
      await executeNextStepInternal(matchId);
    }

    const refreshed = await MatchModel.findById(matchId).select(
      '+simulationSchedule',
    );
    if (refreshed && refreshed.simulationStatus === 'running') {
      const nextStep = refreshed.simulationSchedule.find((s) => !s.executed);
      scheduleNextTick(
        matchId,
        refreshed.minute,
        nextStep,
        refreshed.simulationSpeed,
      );
    }

    return await buildSimulationView(matchId);
  });
}

export async function pauseSimulation(
  matchId: string,
): Promise<SimulationStateView> {
  return await withMatchLock(matchId, async () => {
    const match = await getSimulationMatchOrThrow(matchId);

    if (match.simulationStatus !== 'running') {
      throw new AppError(
        `Cannot pause simulation from status "${match.simulationStatus}"`,
        400,
        'INVALID_SIMULATION_STATE',
      );
    }

    stopSimulationWorker(matchId);
    match.simulationStatus = 'paused';
    await match.save();

    return await buildSimulationView(matchId);
  });
}

export async function resumeSimulation(
  matchId: string,
): Promise<SimulationStateView> {
  return await withMatchLock(matchId, async () => {
    const match = await getSimulationMatchOrThrow(matchId);

    if (match.simulationStatus !== 'paused') {
      throw new AppError(
        `Cannot resume simulation from status "${match.simulationStatus}"`,
        400,
        'INVALID_SIMULATION_STATE',
      );
    }

    match.simulationStatus = 'running';
    await match.save();

    const nextStep = match.simulationSchedule.find((s) => !s.executed);
    scheduleNextTick(matchId, match.minute, nextStep, match.simulationSpeed);

    return await buildSimulationView(matchId);
  });
}

export async function changeSimulationSpeed(
  matchId: string,
  simulationSpeed: number,
): Promise<SimulationStateView> {
  return await withMatchLock(matchId, async () => {
    const match = await getSimulationMatchOrThrow(matchId);

    if (
      match.simulationStatus === 'completed' ||
      match.simulationStatus === 'stopped'
    ) {
      throw new AppError(
        `Cannot change speed when simulation status is "${match.simulationStatus}"`,
        400,
        'INVALID_SIMULATION_STATE',
      );
    }

    match.simulationSpeed = simulationSpeed;
    await match.save();

    if (match.simulationStatus === 'running') {
      const nextStep = match.simulationSchedule.find((s) => !s.executed);
      scheduleNextTick(matchId, match.minute, nextStep, simulationSpeed);
    }

    return await buildSimulationView(matchId);
  });
}

export async function advanceSimulationNextEvent(
  matchId: string,
): Promise<SimulationStateView> {
  return await withMatchLock(matchId, async () => {
    const match = await getSimulationMatchOrThrow(matchId);

    if (
      match.simulationStatus === 'completed' ||
      match.simulationStatus === 'stopped' ||
      match.status === 'finished' ||
      match.status === 'cancelled'
    ) {
      throw new AppError(
        'Simulation is already completed or stopped. Reset it to run again.',
        400,
        'INVALID_SIMULATION_STATE',
      );
    }

    if (!match.simulationSeed) {
      match.simulationSeed = `sim-${match._id.toString()}`;
    }
    const config = normalizeSimulationConfig(match.simulationConfig);
    match.simulationConfig = config;

    if (!match.simulationSchedule || match.simulationSchedule.length === 0) {
      match.simulationSchedule = generateSimulationSchedule(
        match.simulationSeed,
        config,
      );
    }

    if (match.simulationStatus === 'idle') {
      match.simulationStatus = 'paused';
      match.simulationStartedAt = new Date();
    }
    await match.save();

    await executeNextStepInternal(matchId);

    const refreshed = await MatchModel.findById(matchId).select(
      '+simulationSchedule',
    );
    if (refreshed && refreshed.simulationStatus === 'running') {
      const nextStep = refreshed.simulationSchedule.find((s) => !s.executed);
      scheduleNextTick(
        matchId,
        refreshed.minute,
        nextStep,
        refreshed.simulationSpeed,
      );
    }

    return await buildSimulationView(matchId);
  });
}

/**
 * Stops a simulation prematurely without completing it.
 * Cancels the match via match-lifecycle so stopped simulations NEVER affect league standings.
 */
export async function stopSimulation(
  matchId: string,
): Promise<SimulationStateView> {
  return await withMatchLock(matchId, async () => {
    const match = await getSimulationMatchOrThrow(matchId);

    if (match.simulationStatus === 'completed') {
      throw new AppError(
        'Cannot stop a simulation that has already completed',
        400,
        'INVALID_SIMULATION_STATE',
      );
    }

    if (match.simulationStatus === 'stopped') {
      throw new AppError(
        'Simulation is already stopped',
        409,
        'SIMULATION_ALREADY_STOPPED',
      );
    }

    stopSimulationWorker(matchId);

    if (match.status !== 'finished' && match.status !== 'cancelled') {
      await cancelMatch(matchId);
    }

    await MatchModel.updateOne(
      { _id: match._id },
      { $set: { simulationStatus: 'stopped' } },
    );

    return await buildSimulationView(matchId);
  });
}

export async function resetSimulation(
  matchId: string,
  input: ResetSimulationInput = {},
): Promise<SimulationStateView> {
  return await withMatchLock(matchId, async () => {
    const match = await getSimulationMatchOrThrow(matchId);

    stopSimulationWorker(matchId);

    const nextSeed =
      input.simulationSeed ??
      match.simulationSeed ??
      `sim-${match._id.toString()}`;
    const nextSpeed = input.simulationSpeed ?? match.simulationSpeed;
    const nextConfig = normalizeSimulationConfig(
      input.simulationConfig ?? match.simulationConfig,
    );
    const freshSchedule = generateSimulationSchedule(nextSeed, nextConfig);

    await runInTransaction(async (session) => {
      await MatchEventModel.deleteMany(
        { match: match._id },
        session ? { session } : undefined,
      );

      await MatchModel.updateOne(
        { _id: match._id },
        {
          $set: {
            status: 'scheduled',
            homeScore: 0,
            awayScore: 0,
            minute: 0,
            simulationStatus: 'idle',
            simulationSpeed: nextSpeed,
            simulationSeed: nextSeed,
            simulationElapsedSeconds: 0,
            simulationConfig: nextConfig,
            simulationSchedule: freshSchedule,
          },
          $unset: {
            simulationStartedAt: '',
          },
        },
        session ? { session } : undefined,
      );
    });

    return await buildSimulationView(matchId);
  });
}
