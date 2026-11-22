import type { MatchEventType } from '../match-events/match-event.model';
import type { ISimulationConfig, ISimulationStep } from './match.model';

export const DEFAULT_SIMULATION_CONFIG: ISimulationConfig = {
  matchDuration: 90,
  eventFrequency: 12,
  goalProbability: 0.22,
  cardProbability: 0.38,
  substitutionProbability: 0.32,
  maxSubstitutionsPerTeam: 5,
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
  'Badr El Idrissi',
  'Kamil Nowak',
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
  'Oussama Bennani',
  'Lukas Lindner',
];

interface TeamMatchState {
  onPitch: string[];
  bench: string[];
  substitutedOut: Set<string>;
  sentOff: Set<string>;
  yellowCards: Map<string, number>;
  subsUsed: number;
}

/** FNV-1a 32-bit string hash -> unsigned uint32 seed */
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic Mulberry32 PRNG returning [0, 1) — never uses Math.random() */
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
  if (max <= min) return min;
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
    matchDuration:
      partial?.matchDuration ?? DEFAULT_SIMULATION_CONFIG.matchDuration,
    eventFrequency:
      partial?.eventFrequency ?? DEFAULT_SIMULATION_CONFIG.eventFrequency,
    goalProbability:
      partial?.goalProbability ?? DEFAULT_SIMULATION_CONFIG.goalProbability,
    cardProbability:
      partial?.cardProbability ?? DEFAULT_SIMULATION_CONFIG.cardProbability,
    substitutionProbability:
      partial?.substitutionProbability ??
      DEFAULT_SIMULATION_CONFIG.substitutionProbability,
    maxSubstitutionsPerTeam:
      partial?.maxSubstitutionsPerTeam ??
      DEFAULT_SIMULATION_CONFIG.maxSubstitutionsPerTeam,
  };
}

function createTeamState(
  starters: readonly string[],
  bench: readonly string[],
): TeamMatchState {
  return {
    onPitch: [...starters],
    bench: [...bench],
    substitutedOut: new Set<string>(),
    sentOff: new Set<string>(),
    yellowCards: new Map<string, number>(),
    subsUsed: 0,
  };
}

/**
 * Generates a deterministic, realistic football match event schedule.
 * Enforces football rules:
 * - Red cards (direct or 2nd yellow) remove players from the pitch so they cannot act again.
 * - Substitutions respect maxSubstitutionsPerTeam and prevent re-entering substituted players.
 * - Penalties distinguish awarded & scored (`penalty`) vs awarded & missed (`other`).
 * - Events are generated chronologically across 1st and 2nd halves with realistic added time.
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

  const homeState = createTeamState(HOME_PLAYERS, HOME_BENCH);
  const awayState = createTeamState(AWAY_PLAYERS, AWAY_BENCH);

  // Distribute event timestamps chronologically first so stateful rules (red cards, subs)
  // are evaluated in true match-time order.
  const plannedSlots: Array<{
    half: 1 | 2;
    minute: number;
    addedTime: number;
  }> = [];

  for (let i = 0; i < config.eventFrequency; i += 1) {
    const isSecondHalf = rand() < 0.58;
    if (!isSecondHalf) {
      const minute = randomInt(rand, 2, halftimeMinute);
      const addedTime =
        minute === halftimeMinute && rand() < 0.35 ? randomInt(rand, 1, 4) : 0;
      plannedSlots.push({ half: 1, minute, addedTime });
    } else {
      const minute = randomInt(rand, secondHalfStart, duration);
      const addedTime =
        minute === duration && rand() < 0.4 ? randomInt(rand, 1, 6) : 0;
      plannedSlots.push({ half: 2, minute, addedTime });
    }
  }

  plannedSlots.sort((a, b) => {
    if (a.half !== b.half) return a.half - b.half;
    if (a.minute !== b.minute) return a.minute - b.minute;
    return a.addedTime - b.addedTime;
  });

  const firstHalfEvents: Omit<ISimulationStep, 'stepId'>[] = [];
  const secondHalfEvents: Omit<ISimulationStep, 'stepId'>[] = [];

  let totalGoals = 0;
  let totalRedCards = 0;
  const maxGoals = 6;
  const maxRedCards = 2;

  for (const slot of plannedSlots) {
    const teamSide: 'home' | 'away' = rand() < 0.52 ? 'home' : 'away';
    const team = teamSide === 'home' ? homeState : awayState;

    // Safeguard: never leave fewer than 7 active players on the pitch
    if (team.onPitch.length === 0) continue;

    const canSubstitute =
      slot.half === 2 &&
      slot.minute >= Math.min(duration - 1, secondHalfStart + 4) &&
      team.subsUsed < config.maxSubstitutionsPerTeam &&
      team.bench.length > 0 &&
      team.onPitch.length > 1;

    const roll = rand();
    let step: Omit<ISimulationStep, 'stepId'>;

    if (roll < config.goalProbability && totalGoals < maxGoals) {
      const goalRoll = rand();
      const player = pickOne(rand, team.onPitch);

      if (goalRoll < 0.74) {
        totalGoals += 1;
        step = {
          kind: 'event',
          minute: slot.minute,
          addedTime: slot.addedTime,
          teamSide,
          eventType: 'goal',
          player,
          description: 'Clinical finish inside the penalty area',
          executed: false,
        };
      } else if (goalRoll < 0.88) {
        // Penalty awarded & scored
        totalGoals += 1;
        step = {
          kind: 'event',
          minute: slot.minute,
          addedTime: slot.addedTime,
          teamSide,
          eventType: 'penalty',
          player,
          description: 'Penalty awarded and scored from the spot',
          executed: false,
        };
      } else if (goalRoll < 0.94) {
        // Penalty awarded & missed/saved (does NOT increment score)
        step = {
          kind: 'event',
          minute: slot.minute,
          addedTime: slot.addedTime,
          teamSide,
          eventType: 'other',
          player,
          description: 'Penalty awarded — shot saved by the goalkeeper (missed)',
          executed: false,
        };
      } else {
        totalGoals += 1;
        step = {
          kind: 'event',
          minute: slot.minute,
          addedTime: slot.addedTime,
          teamSide,
          eventType: 'own_goal',
          player,
          description: 'Unfortunate deflection into own net',
          executed: false,
        };
      }
    } else if (roll < config.goalProbability + config.cardProbability) {
      const player = pickOne(rand, team.onPitch);
      const priorYellows = team.yellowCards.get(player) ?? 0;
      const canSendOff = totalRedCards < maxRedCards && team.onPitch.length > 7;

      if ((priorYellows >= 1 || rand() < 0.1) && canSendOff) {
        totalRedCards += 1;
        team.sentOff.add(player);
        team.onPitch = team.onPitch.filter((p) => p !== player);

        step = {
          kind: 'event',
          minute: slot.minute,
          addedTime: slot.addedTime,
          teamSide,
          eventType: 'red_card',
          player,
          description:
            priorYellows >= 1
              ? 'Sent off following a second yellow card'
              : 'Direct red card for serious foul play',
          executed: false,
        };
      } else {
        team.yellowCards.set(player, priorYellows + 1);
        step = {
          kind: 'event',
          minute: slot.minute,
          addedTime: slot.addedTime,
          teamSide,
          eventType: 'yellow_card',
          player,
          description: 'Booked for a late challenge',
          executed: false,
        };
      }
    } else if (
      roll <
        config.goalProbability +
          config.cardProbability +
          config.substitutionProbability &&
      canSubstitute
    ) {
      const outIdx = Math.floor(rand() * team.onPitch.length);
      const inIdx = Math.floor(rand() * team.bench.length);
      const playerOut = team.onPitch.splice(outIdx, 1)[0] as string;
      const playerIn = team.bench.splice(inIdx, 1)[0] as string;

      team.substitutedOut.add(playerOut);
      team.onPitch.push(playerIn);
      team.subsUsed += 1;

      step = {
        kind: 'event',
        minute: slot.minute,
        addedTime: slot.addedTime,
        teamSide,
        eventType: 'substitution',
        playerIn,
        playerOut,
        description: `Tactical substitution: ${playerIn} replaces ${playerOut}`,
        executed: false,
      };
    } else {
      const player = pickOne(rand, team.onPitch);
      const eventType: MatchEventType = rand() < 0.5 ? 'var' : 'injury';
      step = {
        kind: 'event',
        minute: slot.minute,
        addedTime: slot.addedTime,
        teamSide,
        eventType,
        player,
        description:
          eventType === 'var'
            ? 'VAR review completed — on-field decision stands'
            : 'Brief stoppage for medical treatment',
        executed: false,
      };
    }

    if (slot.half === 1) {
      firstHalfEvents.push(step);
    } else {
      secondHalfEvents.push(step);
    }
  }

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
