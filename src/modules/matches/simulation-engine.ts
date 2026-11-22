import type { MatchEventType } from '../match-events/match-event.model';
import type { ISimulationConfig, ISimulationStep } from './match.model';

export const DEFAULT_SIMULATION_CONFIG: ISimulationConfig = {
  matchDuration: 90,
  eventFrequency: 12,
  goalProbability: 0.22,
  cardProbability: 0.38,
  substitutionProbability: 0.32,
};

const HOME_PLAYERS = [
  'Lucas Silva',
  'Mateo Alvarez',
  'Karim Benali',
  'Tomas Novak',
  'Diego Morales',
  'Samir Haddad',
  'Julian Weber',
  'Andre Costa',
  'Nabil Mansouri',
  'Hugo Laurent',
  'Marco Conti',
];

const HOME_BENCH = [
  'Rami Tazi',
  'Oscar Lindqvist',
  'Leo Fernandez',
  'Youssef Amrani',
  'Daniel Osei',
];

const AWAY_PLAYERS = [
  'Ibrahim Diallo',
  'Rafael Mendes',
  'Victor Petrov',
  'Liam Connor',
  'Tarek Ziani',
  'Sandro Rossi',
  'Jonas Berg',
  'Kofi Mensah',
  'Amine Chraibi',
  'Pablo Serrano',
  'Noah Becker',
];

const AWAY_BENCH = [
  'Mehdi Alaoui',
  'Filip Horvat',
  'Enzo Bianchi',
  'Adam Kowalski',
  'Sami Khoury',
];

/** FNV-1a 32-bit string hash -> unsigned uint32 seed */
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic Mulberry32 PRNG returning [0, 1) */
function createSeededRandom(seed: string): () => number {
  let state = hashSeed(seed) || 1;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(rand: () => number, min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function pickOne<T>(rand: () => number, list: readonly T[]): T {
  const index = Math.floor(rand() * list.length);
  return list[Math.min(index, list.length - 1)] as T;
}

export function normalizeSimulationConfig(
  partial?: Partial<ISimulationConfig>,
): ISimulationConfig {
  return {
    matchDuration: partial?.matchDuration ?? DEFAULT_SIMULATION_CONFIG.matchDuration,
    eventFrequency: partial?.eventFrequency ?? DEFAULT_SIMULATION_CONFIG.eventFrequency,
    goalProbability: partial?.goalProbability ?? DEFAULT_SIMULATION_CONFIG.goalProbability,
    cardProbability: partial?.cardProbability ?? DEFAULT_SIMULATION_CONFIG.cardProbability,
    substitutionProbability:
      partial?.substitutionProbability ??
      DEFAULT_SIMULATION_CONFIG.substitutionProbability,
  };
}

/**
 * Generates a deterministic, realistic football match event schedule.
 * Includes kickoff, 1st-half events, halftime, 2nd-half kickoff, 2nd-half events, and fulltime.
 */
export function generateSimulationSchedule(
  seed: string,
  rawConfig?: Partial<ISimulationConfig>,
): ISimulationStep[] {
  const config = normalizeSimulationConfig(rawConfig);
  const rand = createSeededRandom(seed);

  const duration = config.matchDuration;
  const halftimeMinute = Math.max(5, Math.floor(duration / 2));
  const secondHalfStart = Math.min(duration, halftimeMinute + 1);

  const firstHalfEvents: Omit<ISimulationStep, 'stepId'>[] = [];
  const secondHalfEvents: Omit<ISimulationStep, 'stepId'>[] = [];

  const homeActive = [...HOME_PLAYERS];
  const homeBench = [...HOME_BENCH];
  const awayActive = [...AWAY_PLAYERS];
  const awayBench = [...AWAY_BENCH];

  let totalGoals = 0;
  let totalRedCards = 0;
  const maxGoals = 6;
  const maxRedCards = 2;

  const targetCount = config.eventFrequency;

  for (let i = 0; i < targetCount; i += 1) {
    // Slightly more events in the 2nd half (substitutions + late drama)
    const isSecondHalf = rand() < 0.58;
    const teamSide: 'home' | 'away' = rand() < 0.52 ? 'home' : 'away';
    const activeRoster = teamSide === 'home' ? homeActive : awayActive;
    const benchRoster = teamSide === 'home' ? homeBench : awayBench;

    // Pick event type from configured probabilities
    const roll = rand();
    let eventType: MatchEventType;

    if (roll < config.goalProbability && totalGoals < maxGoals) {
      const goalRoll = rand();
      if (goalRoll < 0.78) {
        eventType = 'goal';
      } else if (goalRoll < 0.94) {
        eventType = 'penalty';
      } else {
        eventType = 'own_goal';
      }
      totalGoals += 1;
    } else if (roll < config.goalProbability + config.cardProbability) {
      if (rand() < 0.1 && totalRedCards < maxRedCards) {
        eventType = 'red_card';
        totalRedCards += 1;
      } else {
        eventType = 'yellow_card';
      }
    } else if (
      roll <
        config.goalProbability +
          config.cardProbability +
          config.substitutionProbability &&
      isSecondHalf &&
      benchRoster.length > 0 &&
      activeRoster.length > 1
    ) {
      eventType = 'substitution';
    } else {
      eventType = rand() < 0.5 ? 'var' : 'injury';
    }

    let minute: number;
    let addedTime = 0;

    if (!isSecondHalf) {
      minute = randomInt(rand, 2, halftimeMinute);
      if (minute === halftimeMinute && rand() < 0.35) {
        addedTime = randomInt(rand, 1, 4);
      }
    } else if (eventType === 'substitution') {
      const subMin = Math.min(duration - 1, Math.max(secondHalfStart + 5, Math.floor(duration * 0.6)));
      minute = randomInt(rand, subMin, duration);
    } else {
      minute = randomInt(rand, secondHalfStart, duration);
      if (minute === duration && rand() < 0.4) {
        addedTime = randomInt(rand, 1, 6);
      }
    }

    let step: Omit<ISimulationStep, 'stepId'>;

    if (eventType === 'substitution') {
      const outIdx = Math.floor(rand() * activeRoster.length);
      const inIdx = Math.floor(rand() * benchRoster.length);
      const playerOut = activeRoster.splice(outIdx, 1)[0] ?? 'Starter';
      const playerIn = benchRoster.splice(inIdx, 1)[0] ?? 'Substitute';
      activeRoster.push(playerIn);

      step = {
        kind: 'event',
        minute,
        addedTime,
        teamSide,
        eventType: 'substitution',
        playerIn,
        playerOut,
        description: `Tactical substitution: ${playerIn} replaces ${playerOut}`,
        executed: false,
      };
    } else {
      const player = pickOne(rand, activeRoster);
      const descriptions: Record<Exclude<MatchEventType, 'substitution'>, string> = {
        goal: 'Clinical finish inside the penalty area',
        penalty: 'Converted from the penalty spot',
        own_goal: 'Unfortunate deflection into own net',
        yellow_card: 'Booked for a late challenge',
        red_card: 'Sent off for serious foul play',
        injury: 'Brief stoppage for medical treatment',
        var: 'VAR review completed',
        other: 'Match incident recorded',
      };

      step = {
        kind: 'event',
        minute,
        addedTime,
        teamSide,
        eventType,
        player,
        description: descriptions[eventType],
        executed: false,
      };
    }

    if (isSecondHalf) {
      secondHalfEvents.push(step);
    } else {
      firstHalfEvents.push(step);
    }
  }

  const sortByTime = (
    a: Omit<ISimulationStep, 'stepId'>,
    b: Omit<ISimulationStep, 'stepId'>,
  ) => (a.minute !== b.minute ? a.minute - b.minute : a.addedTime - b.addedTime);

  firstHalfEvents.sort(sortByTime);
  secondHalfEvents.sort(sortByTime);

  const ordered: Omit<ISimulationStep, 'stepId'>[] = [
    {
      kind: 'kickoff',
      minute: 1,
      addedTime: 0,
      description: 'First half kickoff',
      executed: false,
    },
    ...firstHalfEvents,
    {
      kind: 'halftime',
      minute: halftimeMinute,
      addedTime: 0,
      description: 'Halftime whistle',
      executed: false,
    },
    {
      kind: 'second_half',
      minute: secondHalfStart,
      addedTime: 0,
      description: 'Second half kickoff',
      executed: false,
    },
    ...secondHalfEvents,
    {
      kind: 'fulltime',
      minute: duration,
      addedTime: 0,
      description: 'Fulltime whistle',
      executed: false,
    },
  ];

  return ordered.map((step, index) => ({
    ...step,
    stepId: `step-${index}`,
  }));
}
