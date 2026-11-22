import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';
import {
  MATCH_EVENT_TYPES,
  type MatchEventType,
} from '../match-events/match-event.model';

export const MATCH_STATUSES = [
  'scheduled',
  'live',
  'halftime',
  'finished',
  'postponed',
  'cancelled',
] as const;

export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const SIMULATION_STATUSES = [
  'idle',
  'running',
  'paused',
  'completed',
] as const;

export type SimulationStatus = (typeof SIMULATION_STATUSES)[number];

export const SIMULATION_STEP_KINDS = [
  'kickoff',
  'event',
  'halftime',
  'second_half',
  'fulltime',
] as const;

export type SimulationStepKind = (typeof SIMULATION_STEP_KINDS)[number];

export interface ISimulationConfig {
  matchDuration: number;
  eventFrequency: number;
  goalProbability: number;
  cardProbability: number;
  substitutionProbability: number;
}

export interface ISimulationStep {
  stepId: string;
  kind: SimulationStepKind;
  minute: number;
  addedTime: number;
  teamSide?: 'home' | 'away' | undefined;
  eventType?: MatchEventType | undefined;
  player?: string | undefined;
  playerIn?: string | undefined;
  playerOut?: string | undefined;
  description?: string | undefined;
  executed: boolean;
  executedEventId?: Types.ObjectId | undefined;
}

export interface IMatch {
  league: Types.ObjectId;
  season: Types.ObjectId;
  homeTeam: Types.ObjectId;
  awayTeam: Types.ObjectId;
  kickoff: Date;
  venue?: string | undefined;
  status: MatchStatus;
  homeScore: number;
  awayScore: number;
  minute: number;
  round?: string | undefined;
  isSimulation: boolean;
  simulationStatus: SimulationStatus;
  simulationSpeed: number;
  simulationSeed?: string | undefined;
  simulationStartedAt?: Date | undefined;
  simulationElapsedSeconds: number;
  simulationConfig?: ISimulationConfig | undefined;
  simulationSchedule: ISimulationStep[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MatchDocument extends IMatch, Document {}

const simulationConfigSchema = new Schema<ISimulationConfig>(
  {
    matchDuration: { type: Number, default: 90, min: 10, max: 120 },
    eventFrequency: { type: Number, default: 12, min: 2, max: 30 },
    goalProbability: { type: Number, default: 0.22, min: 0, max: 1 },
    cardProbability: { type: Number, default: 0.38, min: 0, max: 1 },
    substitutionProbability: { type: Number, default: 0.32, min: 0, max: 1 },
  },
  { _id: false },
);

const simulationStepSchema = new Schema<ISimulationStep>(
  {
    stepId: { type: String, required: true },
    kind: { type: String, enum: SIMULATION_STEP_KINDS, required: true },
    minute: { type: Number, required: true, min: 0, max: 150 },
    addedTime: { type: Number, default: 0, min: 0, max: 30 },
    teamSide: { type: String, enum: ['home', 'away'] },
    eventType: { type: String, enum: MATCH_EVENT_TYPES },
    player: { type: String, trim: true, maxlength: 100 },
    playerIn: { type: String, trim: true, maxlength: 100 },
    playerOut: { type: String, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500 },
    executed: { type: Boolean, default: false, required: true },
    executedEventId: { type: Schema.Types.ObjectId, ref: 'MatchEvent' },
  },
  { _id: false },
);

const matchSchema = new Schema<MatchDocument>(
  {
    league: {
      type: Schema.Types.ObjectId,
      ref: 'League',
      required: true,
    },
    season: {
      type: Schema.Types.ObjectId,
      ref: 'Season',
      required: true,
    },
    homeTeam: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },
    awayTeam: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },
    kickoff: {
      type: Date,
      required: true,
    },
    venue: {
      type: String,
      trim: true,
      maxlength: 150,
    },
    status: {
      type: String,
      enum: MATCH_STATUSES,
      default: 'scheduled',
      required: true,
    },
    homeScore: {
      type: Number,
      default: 0,
      min: 0,
      required: true,
    },
    awayScore: {
      type: Number,
      default: 0,
      min: 0,
      required: true,
    },
    minute: {
      type: Number,
      default: 0,
      min: 0,
      max: 150,
      required: true,
    },
    round: {
      type: String,
      trim: true,
      maxlength: 60,
    },
    isSimulation: {
      type: Boolean,
      default: false,
      required: true,
    },
    simulationStatus: {
      type: String,
      enum: SIMULATION_STATUSES,
      default: 'idle',
      required: true,
    },
    simulationSpeed: {
      type: Number,
      default: 10,
      min: 1,
      max: 120,
      required: true,
    },
    simulationSeed: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    simulationStartedAt: {
      type: Date,
    },
    simulationElapsedSeconds: {
      type: Number,
      default: 0,
      min: 0,
      required: true,
    },
    simulationConfig: {
      type: simulationConfigSchema,
    },
    simulationSchedule: {
      type: [simulationStepSchema],
      default: [],
      select: false,
    },
  },
  {
    timestamps: true,
  },
);

matchSchema.index({ league: 1, season: 1, kickoff: 1 });
matchSchema.index({ league: 1, season: 1, status: 1 });
matchSchema.index({ status: 1, kickoff: 1 });
matchSchema.index({ homeTeam: 1, kickoff: -1 });
matchSchema.index({ awayTeam: 1, kickoff: -1 });
matchSchema.index({ kickoff: 1 });
matchSchema.index({ isSimulation: 1, simulationStatus: 1 });

export const MatchModel: Model<MatchDocument> =
  mongoose.models.Match || mongoose.model<MatchDocument>('Match', matchSchema);
