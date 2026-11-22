import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export const MATCH_STATUSES = [
  'scheduled',
  'live',
  'halftime',
  'finished',
  'postponed',
  'cancelled',
] as const;

export type MatchStatus = (typeof MATCH_STATUSES)[number];

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
  createdAt: Date;
  updatedAt: Date;
}

export interface MatchDocument extends IMatch, Document {}

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
  },
  {
    timestamps: true,
  },
);

matchSchema.index({ league: 1, season: 1, kickoff: 1 });
matchSchema.index({ status: 1, kickoff: 1 });
matchSchema.index({ homeTeam: 1, kickoff: -1 });
matchSchema.index({ awayTeam: 1, kickoff: -1 });
matchSchema.index({ kickoff: 1 });

export const MatchModel: Model<MatchDocument> =
  mongoose.models.Match || mongoose.model<MatchDocument>('Match', matchSchema);
