import mongoose, { Schema, type Document, type Model } from 'mongoose';

export const LEAGUE_TYPES = ['league', 'cup', 'tournament', 'friendly'] as const;
export type LeagueType = (typeof LEAGUE_TYPES)[number];

export interface ILeague {
  name: string;
  country: string;
  logo?: string | undefined;
  type: LeagueType;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeagueDocument extends ILeague, Document {}

const leagueSchema = new Schema<LeagueDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    country: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    logo: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: LEAGUE_TYPES,
      default: 'league',
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

leagueSchema.index(
  { name: 1, country: 1 },
  {
    unique: true,
    collation: { locale: 'en', strength: 2 },
  },
);
leagueSchema.index({ country: 1 });
leagueSchema.index({ type: 1 });

export const LeagueModel: Model<LeagueDocument> =
  mongoose.models.League || mongoose.model<LeagueDocument>('League', leagueSchema);
