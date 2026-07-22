import { Router } from "express";
import { z } from "zod";
import { SearchRun } from "../models/SearchRun.js";
import { asyncHandler, validateBody } from "../middleware/index.js";
import { discover, processPendingLeads, runFullPipeline } from "../services/pipeline/runPipeline.js";
import { importLeads, runExtraSources } from "../services/discovery/sources/runSources.js";
import { runFollowUps } from "../services/outreach/followUp.js";
import { checkWebsite } from "../services/websiteChecker/index.js";

export const pipelineRouter = Router();

const discoverSchema = z
  .object({
    cities: z.array(z.string()).optional(),
    categories: z.array(z.string()).optional(),
  })
  .default({});

/** POST /api/pipeline/discover, run discovery only. */
pipelineRouter.post(
  "/discover",
  validateBody(discoverSchema),
  asyncHandler(async (req, res) => {
    const result = await discover("API", req.body);
    res.json(result);
  }),
);

/** POST /api/pipeline/process, process leads awaiting check/score/pitch. */
pipelineRouter.post(
  "/process",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 200), 500);
    const result = await processPendingLeads(limit);
    res.json(result);
  }),
);

/** POST /api/pipeline/run, full pipeline (discover + process). */
pipelineRouter.post(
  "/run",
  asyncHandler(async (_req, res) => {
    const result = await runFullPipeline("API");
    res.json(result);
  }),
);

/** POST /api/pipeline/discover-sources, run the enabled non-Places sources only. */
pipelineRouter.post(
  "/discover-sources",
  asyncHandler(async (_req, res) => {
    const runs = await runExtraSources();
    const processing = await processPendingLeads();
    res.json({ sources: runs, processing });
  }),
);

const importSchema = z.object({
  city: z.string().optional(),
  category: z.string().optional(),
  process: z.boolean().optional().default(true),
  // Lenient per row so one bad line never rejects the whole batch; importLeads
  // validates and reports invalid rows in the response.
  items: z
    .array(
      z.object({
        businessName: z.string().optional(),
        category: z.string().optional(),
        city: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        instagramUsername: z.string().optional(),
        websiteUrl: z.string().optional(),
        address: z.string().optional(),
        openingSoon: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(2000),
});

/** POST /api/pipeline/import, manual/bulk lead import (Instagram/referral/CAC/canvassing). */
pipelineRouter.post(
  "/import",
  validateBody(importSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof importSchema>;
    const result = await importLeads(body.items, { city: body.city, category: body.category });
    let processing;
    if (body.process && result.created > 0) processing = await processPendingLeads();
    res.json({ ...result, processing });
  }),
);

/** POST /api/pipeline/follow-ups, dispatch due follow-ups. */
pipelineRouter.post(
  "/follow-ups",
  asyncHandler(async (_req, res) => {
    const result = await runFollowUps();
    res.json(result);
  }),
);

/** GET /api/pipeline/runs, discovery run history. */
pipelineRouter.get(
  "/runs",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    const runs = await SearchRun.find().sort({ startedAt: -1 }).limit(limit).lean();
    res.json({ runs });
  }),
);

/** POST /api/pipeline/check-website, ad-hoc website check (also used by n8n). */
pipelineRouter.post(
  "/check-website",
  validateBody(z.object({ url: z.string().min(4) })),
  asyncHandler(async (req, res) => {
    const { url } = req.body as { url: string };
    const result = await checkWebsite(url);
    res.json(result);
  }),
);
