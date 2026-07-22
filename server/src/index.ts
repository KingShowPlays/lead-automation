import { createApp } from "./app.js";
import { config, integrations } from "./config/index.js";
import { connectDb, disconnectDb } from "./db/connect.js";
import { getSettings } from "./models/Settings.js";
import { startScheduler, stopScheduler } from "./services/scheduler.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  await connectDb();
  await getSettings(); // ensure the settings singleton exists

  const app = createApp();
  const server = app.listen(config.PORT, () => {
    logger.info(
      {
        port: config.PORT,
        env: config.NODE_ENV,
        integrations: {
          googlePlaces: integrations.placesConfigured,
          ai: integrations.aiConfigured,
          gmail: integrations.gmailConfigured,
          auth: integrations.authEnabled,
        },
      },
      "YEAN lead-automation server ready",
    );
    if (!integrations.authEnabled) {
      logger.warn("API_KEY is not set — the API is UNAUTHENTICATED. Set API_KEY before deploying.");
    }
  });

  startScheduler();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "shutting down");
    stopScheduler();
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
    // Force-exit if close hangs.
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error({ err: err instanceof Error ? err.stack : String(err) }, "fatal startup error");
  process.exit(1);
});
