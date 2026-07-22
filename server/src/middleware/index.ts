import type { NextFunction, Request, Response } from "express";
import { config, integrations } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { ZodError, type ZodSchema } from "zod";

/** API-key auth. Open when API_KEY is unset (local dev), enforced otherwise. */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  if (!integrations.authEnabled) return next();
  const provided = req.header("x-api-key") ?? (req.query.api_key as string | undefined);
  if (provided && timingSafeEqualStr(provided, config.API_KEY)) return next();
  res.status(401).json({ error: "Unauthorized — missing or invalid x-api-key header" });
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/** Validates req.body against a zod schema, replying 400 on failure. */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: "Validation failed", details: result.error.flatten() });
      return;
    }
    req.body = result.data;
    next();
  };
}

/** Wraps async route handlers so rejections hit the error middleware. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

/** Central error handler — keeps stack traces out of responses. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Validation failed", details: err.flatten() });
    return;
  }
  const message = err instanceof Error ? err.message : "Internal server error";
  const status = /not configured|cannot run/i.test(message) ? 503 : 500;
  logger.error({ err: err instanceof Error ? err.stack : String(err), path: req.path }, "request failed");
  res.status(status).json({ error: message });
}
