import { Router } from "express";
import { z } from "zod";
import { getSettings, Settings } from "../models/Settings.js";
import { asyncHandler, validateBody } from "../middleware/index.js";

export const settingsRouter = Router();

/** GET /api/settings */
settingsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const settings = await getSettings();
    res.json({ settings });
  }),
);

const weightsSchema = z
  .object({
    noWebsite: z.number(),
    brokenWebsite: z.number(),
    socialOrLinkInBioOnly: z.number(),
    shopifyWebsite: z.number(),
    publicEmail: z.number(),
    whatsappAvailable: z.number(),
    recentlyOpened: z.number(),
    activeInstagram: z.number(),
    strongVisualBrand: z.number(),
    customWebsitePenalty: z.number(),
    poorWebsite: z.number(),
    menuPlatformOnly: z.number(),
  })
  .partial();

/** PUT /api/settings */
settingsRouter.put(
  "/",
  validateBody(
    z
      .object({
        cities: z.array(z.string().min(1)).min(1).optional(),
        categories: z.array(z.string().min(1)).min(1).optional(),
        scoreThreshold: z.number().min(0).max(200).optional(),
        scoringWeights: weightsSchema.optional(),
        followUpDays: z.number().int().min(1).max(60).optional(),
        maxContactAttempts: z.number().int().min(1).max(5).optional(),
        dailyEmailCap: z.number().int().min(1).max(500).optional(),
        discoveryEnabled: z.boolean().optional(),
        maxResultsPerQuery: z.number().int().min(1).max(60).optional(),
      })
      .strict(),
  ),
  asyncHandler(async (req, res) => {
    const settings = await getSettings();
    const body = req.body as Record<string, unknown>;
    const { scoringWeights, ...rest } = body;
    Object.assign(settings, rest);
    if (scoringWeights) {
      Object.assign(settings.scoringWeights, scoringWeights);
    }
    await settings.save();
    res.json({ settings });
  }),
);

/** POST /api/settings/reset — restore defaults. */
settingsRouter.post(
  "/reset",
  asyncHandler(async (_req, res) => {
    await Settings.deleteOne({ key: "global" });
    const settings = await getSettings();
    res.json({ settings });
  }),
);
