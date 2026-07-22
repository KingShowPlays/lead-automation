import mongoose, { Schema, type Document, type Model } from "mongoose";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_CITIES,
  DEFAULT_SCORING_WEIGHTS,
  type ScoringWeights,
} from "../types.js";
import { config } from "../config/index.js";

/**
 * Singleton settings document. Editable from the dashboard so search
 * targets and scoring can be tuned without redeploying.
 */
export interface SettingsDocument extends Document {
  key: "global";
  cities: string[];
  categories: string[];
  scoreThreshold: number;
  scoringWeights: ScoringWeights;
  followUpDays: number;
  maxContactAttempts: number;
  dailyEmailCap: number;
  discoveryEnabled: boolean;
  /** Max Places results requested per query (each page = 20; 3 pages max). */
  maxResultsPerQuery: number;
  updatedAt: Date;
}

const settingsSchema = new Schema<SettingsDocument>(
  {
    key: { type: String, default: "global", unique: true },
    cities: { type: [String], default: DEFAULT_CITIES },
    categories: { type: [String], default: DEFAULT_CATEGORIES },
    scoreThreshold: { type: Number, default: config.SCORE_THRESHOLD },
    scoringWeights: {
      noWebsite: { type: Number, default: DEFAULT_SCORING_WEIGHTS.noWebsite },
      brokenWebsite: { type: Number, default: DEFAULT_SCORING_WEIGHTS.brokenWebsite },
      socialOrLinkInBioOnly: { type: Number, default: DEFAULT_SCORING_WEIGHTS.socialOrLinkInBioOnly },
      shopifyWebsite: { type: Number, default: DEFAULT_SCORING_WEIGHTS.shopifyWebsite },
      publicEmail: { type: Number, default: DEFAULT_SCORING_WEIGHTS.publicEmail },
      whatsappAvailable: { type: Number, default: DEFAULT_SCORING_WEIGHTS.whatsappAvailable },
      recentlyOpened: { type: Number, default: DEFAULT_SCORING_WEIGHTS.recentlyOpened },
      activeInstagram: { type: Number, default: DEFAULT_SCORING_WEIGHTS.activeInstagram },
      strongVisualBrand: { type: Number, default: DEFAULT_SCORING_WEIGHTS.strongVisualBrand },
      customWebsitePenalty: { type: Number, default: DEFAULT_SCORING_WEIGHTS.customWebsitePenalty },
      poorWebsite: { type: Number, default: DEFAULT_SCORING_WEIGHTS.poorWebsite },
      menuPlatformOnly: { type: Number, default: DEFAULT_SCORING_WEIGHTS.menuPlatformOnly },
    },
    followUpDays: { type: Number, default: config.FOLLOW_UP_DAYS },
    maxContactAttempts: { type: Number, default: config.MAX_CONTACT_ATTEMPTS },
    dailyEmailCap: { type: Number, default: config.DAILY_EMAIL_CAP },
    discoveryEnabled: { type: Boolean, default: true },
    maxResultsPerQuery: { type: Number, default: 60 },
  },
  { timestamps: true },
);

export const Settings: Model<SettingsDocument> =
  (mongoose.models.Settings as Model<SettingsDocument>) ??
  mongoose.model<SettingsDocument>("Settings", settingsSchema);

export async function getSettings(): Promise<SettingsDocument> {
  const existing = await Settings.findOne({ key: "global" });
  if (existing) return existing;
  return Settings.create({ key: "global" });
}
