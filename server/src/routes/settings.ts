import { Router } from "express";
import { z } from "zod";
import cron from "node-cron";
import { getSettings, Settings, type SettingsDocument } from "../models/Settings.js";
import { Lead } from "../models/Lead.js";
import { OutreachLog } from "../models/OutreachLog.js";
import { PipelineJob } from "../models/PipelineJob.js";
import { PipelineLease } from "../models/PipelineLease.js";
import { SearchRun } from "../models/SearchRun.js";
import { Suppression } from "../models/Suppression.js";
import { asyncHandler, validateBody } from "../middleware/index.js";
import {
  getAiRuntime,
  getEmailRuntime,
  getPlacesKey,
  integrationStatus,
  isMaskedValue,
  maskSecret,
} from "../config/runtime.js";
import {
  recordAiProviderFailure,
  recordAiProviderProbeSuccess,
  runAiPrompt,
} from "../services/pitch/generatePitch.js";
import { getActiveEmail } from "../services/outreach/email/index.js";
import { searchPlaces } from "../services/discovery/googlePlaces.js";
import { reloadScheduler } from "../services/scheduler.js";
import { logger } from "../utils/logger.js";

export const settingsRouter = Router();

/* ------------------------------------------------------------------ */
/* Masking                                                             */
/* ------------------------------------------------------------------ */

/** Paths inside settings.integrations whose values are secrets. */
const SECRET_PATHS = [
  ["googlePlacesApiKey"],
  ["ai", "apiKey"],
  ["email", "gmail", "clientSecret"],
  ["email", "gmail", "refreshToken"],
  ["email", "zoho", "password"],
  ["email", "resend", "apiKey"],
] as const;

type AnyRecord = Record<string, unknown>;

function getPath(obj: AnyRecord, path: readonly string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as AnyRecord)[key];
  }
  return cur;
}

function setPath(obj: AnyRecord, path: readonly string[], value: unknown): void {
  let cur: AnyRecord = obj;
  for (const key of path.slice(0, -1)) {
    if (cur[key] == null || typeof cur[key] !== "object") cur[key] = {};
    cur = cur[key] as AnyRecord;
  }
  cur[path[path.length - 1]] = value;
}

/** Returns a plain settings object with all secrets masked for transport. */
export function maskedSettings(settings: SettingsDocument): AnyRecord {
  const obj = settings.toObject({ versionKey: false }) as AnyRecord;
  const integrations = (obj.integrations ?? {}) as AnyRecord;
  for (const path of SECRET_PATHS) {
    const value = getPath(integrations, path);
    setPath(integrations, path, maskSecret(typeof value === "string" ? value : ""));
  }
  obj.integrations = integrations;
  return obj;
}

/**
 * Merges a submitted integrations patch into the stored document, keeping
 * the existing value wherever the client sent back a masked placeholder.
 */
export function applyIntegrationsPatch(current: AnyRecord, patch: AnyRecord): void {
  for (const [key, value] of Object.entries(patch)) {
    if (value != null && typeof value === "object" && !Array.isArray(value)) {
      if (current[key] == null || typeof current[key] !== "object") current[key] = {};
      applyIntegrationsPatch(current[key] as AnyRecord, value as AnyRecord);
    } else if (isMaskedValue(value)) {
      // Masked placeholder → keep the stored secret.
      continue;
    } else {
      current[key] = value;
    }
  }
}

/* ------------------------------------------------------------------ */
/* GET / PUT                                                           */
/* ------------------------------------------------------------------ */

/** GET /api/settings, secrets masked. */
settingsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const settings = await getSettings();
    res.json({ settings: maskedSettings(settings) });
  }),
);

const weightsSchema = z
  .object({
    noWebsite: z.number(),
    brokenWebsite: z.number(),
    socialOrLinkInBioOnly: z.number(),
    shopifyWebsite: z.number(),
    poorWebsite: z.number(),
    menuPlatformOnly: z.number(),
    customWebsitePenalty: z.number(),
    openingSoon: z.number(),
    newBusiness: z.number(),
    emergingBusiness: z.number(),
    newToGoogle: z.number(),
    risingActivity: z.number(),
    wellRated: z.number(),
    strongVisualBrand: z.number(),
    publicEmail: z.number(),
    whatsappAvailable: z.number(),
    phoneOnly: z.number(),
    activeInstagram: z.number(),
    recentlyOpened: z.number(),
  })
  .partial();

const integrationsSchema = z
  .object({
    googlePlacesApiKey: z.string().max(300).optional(),
    ai: z
      .object({
        provider: z.enum(["AUTO", "OPENAI", "ANTHROPIC", "GROQ", "NVIDIA", "CUSTOM", "NONE"]).optional(),
        apiKey: z.string().max(500).optional(),
        model: z.string().max(200).optional(),
        requestsPerMinute: z.number().int().min(1).max(300).optional(),
        baseUrl: z
          .string()
          .max(500)
          .refine((v) => v === "" || /^https?:\/\//.test(v), "baseUrl must be an http(s) URL")
          .optional(),
      })
      .strict()
      .optional(),
    email: z
      .object({
        provider: z.enum(["AUTO", "GMAIL", "ZOHO", "RESEND", "NONE"]).optional(),
        fromAddress: z
          .string()
          .max(320)
          .refine((v) => v === "" || z.string().email().safeParse(v).success, "fromAddress must be an email")
          .optional(),
        fromName: z.string().max(120).optional(),
        gmail: z
          .object({
            clientId: z.string().max(300).optional(),
            clientSecret: z.string().max(300).optional(),
            refreshToken: z.string().max(500).optional(),
          })
          .strict()
          .optional(),
        zoho: z
          .object({
            host: z.string().max(200).optional(),
            port: z.number().int().min(1).max(65535).optional(),
            secure: z.boolean().optional(),
            user: z.string().max(320).optional(),
            password: z.string().max(300).optional(),
          })
          .strict()
          .optional(),
        resend: z.object({ apiKey: z.string().max(300).optional() }).strict().optional(),
      })
      .strict()
      .optional(),
    scheduler: z
      .object({
        enabled: z.boolean().nullable().optional(),
        discoveryCron: z
          .string()
          .max(100)
          .refine((v) => v === "" || cron.validate(v), "discoveryCron is not a valid cron expression")
          .optional(),
        followUpCron: z
          .string()
          .max(100)
          .refine((v) => v === "" || cron.validate(v), "followUpCron is not a valid cron expression")
          .optional(),
        timezone: z.string().max(80).optional(),
      })
      .strict()
      .optional(),
    checker: z
      .object({
        timeoutMs: z.number().int().min(0).max(120000).optional(),
        maxRedirects: z.number().int().min(0).max(30).optional(),
        concurrency: z.number().int().min(0).max(20).optional(),
      })
      .strict()
      .optional(),
    sources: z
      .object({
        manualImportEnabled: z.boolean().optional(),
        directory: z
          .object({
            enabled: z.boolean().optional(),
            urls: z
              .array(
                z
                  .string()
                  .max(500)
                  .refine((v) => v === "" || /^https?:\/\//.test(v), "each directory URL must be http(s)"),
              )
              .max(50)
              .optional(),
            defaultCity: z.string().max(80).optional(),
            defaultCategory: z.string().max(80).optional(),
            maxPerRun: z.number().int().min(1).max(500).optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

/** PUT /api/settings, partial update; masked secrets are preserved. */
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
        placesRequestsPerMinute: z.number().int().min(1).max(120).optional(),
        integrations: integrationsSchema.optional(),
        pitch: z.object({ reuseAcrossSimilarLeads: z.boolean().optional() }).strict().optional(),
      })
      .strict(),
  ),
  asyncHandler(async (req, res) => {
    const settings = await getSettings();
    const body = req.body as AnyRecord;
    const { scoringWeights, integrations, pitch, ...rest } = body;
    Object.assign(settings, rest);
    if (scoringWeights) {
      Object.assign(settings.scoringWeights, scoringWeights);
    }
    if (pitch) {
      // Merged rather than assigned, so a patch carrying one field does not
      // silently reset the others to their defaults.
      settings.set("pitch", { ...(settings.pitch ?? {}), ...(pitch as AnyRecord) });
    }
    if (integrations) {
      const current = (settings.integrations ?? {}) as unknown as AnyRecord;
      applyIntegrationsPatch(current, integrations as AnyRecord);
      settings.set("integrations", current);
      settings.markModified("integrations");
    }
    await settings.save();

    // Apply scheduler changes immediately, no restart required. Never let
    // a scheduler problem fail the save itself.
    reloadScheduler().catch((err) => logger.error({ err: String(err) }, "scheduler reload failed"));

    res.json({ settings: maskedSettings(settings) });
  }),
);

/** POST /api/settings/onboarding, mark the first-run wizard complete (or re-open it). */
settingsRouter.post(
  "/onboarding",
  validateBody(z.object({ complete: z.boolean() }).strict()),
  asyncHandler(async (req, res) => {
    const settings = await getSettings();
    settings.onboardedAt = (req.body as { complete: boolean }).complete ? new Date() : null;
    await settings.save();
    res.json({ onboardedAt: settings.onboardedAt });
  }),
);

/**
 * POST /api/settings/wipe-data, empty the working data and keep the setup.
 *
 * Settings and the site theme survive, so the connected providers, targets,
 * scoring weights and look all remain: this is for clearing out a trial run or
 * a bad import, not for starting the deployment again.
 *
 * The suppression list survives by default and only goes if it is asked for
 * explicitly. It is the record of who said do not contact me, and losing it
 * makes those people contactable again, which is the one deletion here that
 * cannot be undone by running another scan.
 */
settingsRouter.post(
  "/wipe-data",
  validateBody(z.object({ includeSuppression: z.boolean().default(false) }).strict()),
  asyncHandler(async (req, res) => {
    const { includeSuppression } = req.body as { includeSuppression: boolean };

    const [leads, outreach, jobs, leases, runs] = await Promise.all([
      Lead.deleteMany({}),
      OutreachLog.deleteMany({}),
      PipelineJob.deleteMany({}),
      PipelineLease.deleteMany({}),
      SearchRun.deleteMany({}),
    ]);
    const suppression = includeSuppression ? await Suppression.deleteMany({}) : null;

    const deleted = {
      leads: leads.deletedCount ?? 0,
      outreachLogs: outreach.deletedCount ?? 0,
      pipelineJobs: jobs.deletedCount ?? 0,
      pipelineLeases: leases.deletedCount ?? 0,
      searchRuns: runs.deletedCount ?? 0,
      suppression: suppression?.deletedCount ?? 0,
    };
    logger.warn({ deleted, includeSuppression }, "working data wiped on request");
    res.json({ deleted, keptSuppression: !includeSuppression });
  }),
);

/** POST /api/settings/reset, restore defaults (wipes stored credentials too). */
settingsRouter.post(
  "/reset",
  asyncHandler(async (_req, res) => {
    await Settings.deleteOne({ key: "global" });
    const settings = await getSettings();
    reloadScheduler().catch((err) => logger.error({ err: String(err) }, "scheduler reload failed"));
    res.json({ settings: maskedSettings(settings) });
  }),
);

/* ------------------------------------------------------------------ */
/* Status + connection tests                                           */
/* ------------------------------------------------------------------ */

/** GET /api/settings/integrations, resolved provider status (no secrets). */
settingsRouter.get(
  "/integrations",
  asyncHandler(async (_req, res) => {
    res.json(await integrationStatus());
  }),
);

/** POST /api/settings/test-ai, round-trips a tiny prompt through the configured provider. */
settingsRouter.post(
  "/test-ai",
  asyncHandler(async (_req, res) => {
    const ai = await getAiRuntime();
    if (!ai.configured) {
      return res.json({ ok: false, error: "No AI provider configured. Save your provider settings first." });
    }
    try {
      const started = Date.now();
      const result = await runAiPrompt('Reply with exactly the word "OK" and nothing else.', ai);
      recordAiProviderProbeSuccess(ai);
      res.json({
        ok: true,
        provider: ai.provider,
        model: result.model,
        latencyMs: Date.now() - started,
        reply: result.text.slice(0, 80),
      });
    } catch (err) {
      recordAiProviderFailure(ai, err);
      res.json({ ok: false, provider: ai.provider, model: ai.model, error: err instanceof Error ? err.message : String(err) });
    }
  }),
);

/** POST /api/settings/test-email, verifies credentials with the active provider. */
settingsRouter.post(
  "/test-email",
  asyncHandler(async (_req, res) => {
    const runtime = await getEmailRuntime();
    if (!runtime.configured) {
      // Name what is actually absent. "Not configured" sends the operator back
      // to a form of twenty fields with no idea which one is the problem.
      return res.json({
        ok: false,
        error: runtime.missing.length
          ? `Not ready to send. Still needed: ${runtime.missing.join("; ")}.`
          : "No email provider is set up yet. Choose one above, fill it in, and save.",
      });
    }
    const { provider } = await getActiveEmail();
    if (!provider) return res.json({ ok: false, error: "Email provider could not be initialised" });
    try {
      const started = Date.now();
      await provider.verify();
      res.json({
        ok: true,
        provider: provider.name,
        fromAddress: runtime.fromAddress,
        supportsDrafts: provider.supportsDrafts,
        latencyMs: Date.now() - started,
      });
    } catch (err) {
      res.json({ ok: false, provider: provider.name, error: err instanceof Error ? err.message : String(err) });
    }
  }),
);

/** POST /api/settings/test-places, one cheap Text Search request. */
settingsRouter.post(
  "/test-places",
  asyncHandler(async (_req, res) => {
    const key = await getPlacesKey();
    if (!key) {
      return res.json({ ok: false, error: "No Google Places API key configured. Save it first." });
    }
    try {
      const started = Date.now();
      const settings = await getSettings();
      const results = await searchPlaces("restaurants in Lagos", "Lagos", "restaurants", {
        apiKey: key,
        maxResults: 1,
        requestsPerMinute: settings.placesRequestsPerMinute,
      });
      res.json({ ok: true, latencyMs: Date.now() - started, sample: results[0]?.businessName ?? null });
    } catch (err) {
      res.json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }),
);
