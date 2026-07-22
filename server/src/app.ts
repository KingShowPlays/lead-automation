import express, { type Express } from "express";
import cors from "cors";
import { config } from "./config/index.js";
import { apiKeyAuth, errorHandler } from "./middleware/index.js";
import { leadsRouter } from "./routes/leads.js";
import { pipelineRouter } from "./routes/pipeline.js";
import { suppressionRouter } from "./routes/suppression.js";
import { settingsRouter } from "./routes/settings.js";
import { statsRouter } from "./routes/stats.js";

/** Builds the Express app (separated from index.ts so tests can import it). */
export function createApp(): Express {
  const app = express();

  app.set("trust proxy", 1); // Railway runs behind a proxy
  app.use(express.json({ limit: "1mb" }));
  app.use(
    cors({
      origin: config.DASHBOARD_ORIGIN.split(",").map((o) => o.trim()),
      credentials: false,
    }),
  );

  // Health check — unauthenticated so Railway can probe it.
  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "yean-lead-automation", time: new Date().toISOString() });
  });

  app.use("/api", apiKeyAuth);
  app.use("/api/leads", leadsRouter);
  app.use("/api/pipeline", pipelineRouter);
  app.use("/api/suppression", suppressionRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/stats", statsRouter);

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));
  app.use(errorHandler);

  return app;
}
