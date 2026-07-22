import pino from "pino";
import { config } from "../config/index.js";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (config.NODE_ENV === "test" ? "silent" : "info"),
  ...(config.NODE_ENV === "development"
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:HH:MM:ss" },
        },
      }
    : {}),
});
