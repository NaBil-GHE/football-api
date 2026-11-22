import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface ITeam {
  name: string;
  shortName: string;
  country: string;
  logo?: string | undefined;
  founded?: number | undefined;
  stadium?: string | undefined;
  description?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamDocument extends ITeam, Document {}

const teamSchema = new Schema<TeamDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    shortName: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 2,
      maxlength: 20,
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
    founded: {
      type: Number,
      min: 1850,
      max: new Date().getUTCFullYear() + 1,
    },
    stadium: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  },
);

teamSchema.index(
  { name: 1, country: 1 },
  {
    unique: true,
    collation: { locale: 'en', strength: 2 },
  },
);
teamSchema.index({ country: 1 });
teamSchema.index({ shortName: 1 });

export const TeamModel: Model<TeamDocument> =
  mongoose.models.Team || mongoose.model<TeamDocument>('Team', teamSchema);
