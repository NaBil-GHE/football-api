import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface ISeason {
  league: Types.ObjectId;
  name: string;
  startDate: Date;
  endDate: Date;
  current: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SeasonDocument extends ISeason, Document {}

const seasonSchema = new Schema<SeasonDocument>(
  {
    league: {
      type: Schema.Types.ObjectId,
      ref: 'League',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 60,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    current: {
      type: Boolean,
      default: false,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

seasonSchema.index(
  { league: 1, name: 1 },
  {
    unique: true,
    collation: { locale: 'en', strength: 2 },
  },
);
seasonSchema.index({ league: 1, current: 1 });
seasonSchema.index({ league: 1, startDate: -1 });

export const SeasonModel: Model<SeasonDocument> =
  mongoose.models.Season || mongoose.model<SeasonDocument>('Season', seasonSchema);
