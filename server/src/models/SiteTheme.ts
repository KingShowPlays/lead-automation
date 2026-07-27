import mongoose, { Schema, type Document, type Model } from "mongoose";

/**
 * Singleton store for the dashboard's appearance.
 *
 * The document holds the theme as an opaque object rather than a mirrored
 * schema. The dashboard owns the token shape and normalises every field it
 * reads, so duplicating that shape here would only give the two halves
 * something to disagree about. What this layer is responsible for is that the
 * value is a plain object, that it is not large enough to be a problem, and
 * that there is exactly one of them.
 */

export interface SiteThemeDocument extends Document {
  key: string;
  theme: Record<string, unknown>;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const siteThemeSchema = new Schema<SiteThemeDocument>(
  {
    key: { type: String, required: true, unique: true, default: "site" },
    theme: { type: Schema.Types.Mixed, default: {} },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true, minimize: false },
);

export const SiteTheme: Model<SiteThemeDocument> =
  (mongoose.models.SiteTheme as Model<SiteThemeDocument>) ??
  mongoose.model<SiteThemeDocument>("SiteTheme", siteThemeSchema);

export async function getSiteTheme(): Promise<SiteThemeDocument> {
  const existing = await SiteTheme.findOne({ key: "site" });
  if (existing) return existing;
  return SiteTheme.create({ key: "site", theme: {} });
}
