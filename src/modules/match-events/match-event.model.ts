import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export const MATCH_EVENT_TYPES = [
  'goal',
  'own_goal',
  'penalty',
  'yellow_card',
  'red_card',
  'substitution',
  'injury',
  'var',
  'other',
] as const;

export type MatchEventType = (typeof MATCH_EVENT_TYPES)[number];

export interface IMatchEvent {
  match: Types.ObjectId;
  team: Types.ObjectId;
  type: MatchEventType;
  minute: number;
  addedTime: number;
  player?: string | undefined;
  playerIn?: string | undefined;
  playerOut?: string | undefined;
  description?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface MatchEventDocument extends IMatchEvent, Document {}

const matchEventSchema = new Schema<MatchEventDocument>(
  {
    match: {
      type: Schema.Types.ObjectId,
      ref: 'Match',
      required: true,
    },
    team: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },
    type: {
      type: String,
      enum: MATCH_EVENT_TYPES,
      required: true,
    },
    minute: {
      type: Number,
      required: true,
      min: 0,
      max: 150,
    },
    addedTime: {
      type: Number,
      default: 0,
      min: 0,
      max: 30,
      required: true,
    },
    player: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    playerIn: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    playerOut: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  },
);

matchEventSchema.index({ match: 1, minute: 1, addedTime: 1, createdAt: 1 });
matchEventSchema.index({ team: 1 });
matchEventSchema.index({ match: 1, type: 1 });

export const MatchEventModel: Model<MatchEventDocument> =
  mongoose.models.MatchEvent ||
  mongoose.model<MatchEventDocument>('MatchEvent', matchEventSchema);
