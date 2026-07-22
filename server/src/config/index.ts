import "dotenv/config";
import { z } from "zod";

/**
 * Environment configuration, validated at boot.
 * Every value has a sensible default so the server can start locally
 * with nothing but a MongoDB instance; external integrations
 * (Places, AI, Gmail) degrade gracefully when their keys are absent.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().default("mongodb://localhost:27017/yean_leads"),

  API_KEY: z.string().optional().default(""),
  DASHBOARD_ORIGIN: z.string().default("http://localhost:3000"),

  GOOGLE_PLACES_API_KEY: z.string().optional().default(""),

  OPENAI_API_KEY: z.string().optional().default(""),
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  PITCH_PROVIDER: z.enum(["auto", "openai", "anthropic"]).default("auto"),
  PITCH_MODEL: z.string().optional().default(""),

  GMAIL_CLIENT_ID: z.string().optional().default(""),
  GMAIL_CLIENT_SECRET: z.string().optional().default(""),
  GMAIL_REFRESH_TOKEN: z.string().optional().default(""),
  GMAIL_SENDER: z.string().optional().default(""),
  GMAIL_SENDER_NAME: z.string().default("YEAN Technologies"),

  ENABLE_SCHEDULER: z
    .string()
    .default("true")
    .transform((v) => v.toLowerCase() !== "false" && v !== "0"),
  DISCOVERY_CRON: z.string().default("0 7 * * *"),
  FOLLOWUP_CRON: z.string().default("0 9 * * *"),
  TIMEZONE: z.string().default("Africa/Lagos"),

  SCORE_THRESHOLD: z.coerce.number().default(50),
  FOLLOW_UP_DAYS: z.coerce.number().int().positive().default(4),
  MAX_CONTACT_ATTEMPTS: z.coerce.number().int().positive().default(2),
  DAILY_EMAIL_CAP: z.coerce.number().int().positive().default(25),

  /** Website checker tuning */
  CHECKER_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  CHECKER_MAX_REDIRECTS: z.coerce.number().int().positive().default(10),
  CHECKER_CONCURRENCY: z.coerce.number().int().positive().default(3),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;

export const integrations = {
  get placesConfigured(): boolean {
    return Boolean(config.GOOGLE_PLACES_API_KEY);
  },
  get aiConfigured(): boolean {
    return Boolean(config.OPENAI_API_KEY || config.ANTHROPIC_API_KEY);
  },
  get gmailConfigured(): boolean {
    return Boolean(
      config.GMAIL_CLIENT_ID && config.GMAIL_CLIENT_SECRET && config.GMAIL_REFRESH_TOKEN && config.GMAIL_SENDER,
    );
  },
  get authEnabled(): boolean {
    return Boolean(config.API_KEY);
  },
};
