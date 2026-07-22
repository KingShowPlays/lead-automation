import cron, { type ScheduledTask } from "node-cron";
import { config, integrations } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { getSettings } from "../models/Settings.js";
import { runFullPipeline } from "./pipeline/runPipeline.js";
import { runFollowUps } from "./outreach/followUp.js";

/**
 * Built-in scheduler so the service is fully self-contained on Railway.
 * (n8n can also drive the same endpoints externally — see n8n/workflow.json.)
 */

const tasks: ScheduledTask[] = [];
let discoveryRunning = false;

export function startScheduler(): void {
  if (!config.ENABLE_SCHEDULER) {
    logger.info("Scheduler disabled (ENABLE_SCHEDULER=false) — use the API or n8n to trigger runs");
    return;
  }

  // Daily discovery + processing
  tasks.push(
    cron.schedule(
      config.DISCOVERY_CRON,
      async () => {
        if (discoveryRunning) {
          logger.warn("Skipping scheduled discovery — previous run still in progress");
          return;
        }
        const settings = await getSettings().catch(() => null);
        if (settings && !settings.discoveryEnabled) {
          logger.info("Scheduled discovery skipped — disabled in settings");
          return;
        }
        if (!integrations.placesConfigured) {
          logger.warn("Scheduled discovery skipped — GOOGLE_PLACES_API_KEY not set");
          return;
        }
        discoveryRunning = true;
        try {
          const result = await runFullPipeline("CRON");
          logger.info(result, "scheduled pipeline run finished");
        } catch (err) {
          logger.error({ err: String(err) }, "scheduled pipeline run failed");
        } finally {
          discoveryRunning = false;
        }
      },
      { timezone: config.TIMEZONE },
    ),
  );

  // Daily follow-ups
  tasks.push(
    cron.schedule(
      config.FOLLOWUP_CRON,
      async () => {
        try {
          const result = await runFollowUps();
          logger.info(result, "scheduled follow-up run finished");
        } catch (err) {
          logger.error({ err: String(err) }, "scheduled follow-up run failed");
        }
      },
      { timezone: config.TIMEZONE },
    ),
  );

  logger.info(
    { discovery: config.DISCOVERY_CRON, followUps: config.FOLLOWUP_CRON, tz: config.TIMEZONE },
    "Scheduler started",
  );
}

export function stopScheduler(): void {
  for (const t of tasks) t.stop();
  tasks.length = 0;
}
