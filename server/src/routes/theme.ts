import { Router } from "express";
import { getSiteTheme, SiteTheme } from "../models/SiteTheme.js";
import { asyncHandler } from "../middleware/index.js";

export const themeRouter = Router();

/**
 * A theme is a few kilobytes of tokens. Anything an order of magnitude past
 * that is either a mistake or an attempt to use the settings store as a
 * general-purpose blob, and neither should be written.
 */
const MAX_THEME_BYTES = 64 * 1024;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** GET /api/theme, the stored appearance. Empty object means "use defaults". */
themeRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const doc = await getSiteTheme();
    res.json({ theme: doc.theme ?? {}, updatedAt: doc.updatedAt, updatedBy: doc.updatedBy ?? "" });
  }),
);

/** PUT /api/theme, replace the appearance wholesale. */
themeRouter.put(
  "/",
  asyncHandler(async (req, res) => {
    const body = req.body as { theme?: unknown; updatedBy?: unknown };
    const theme = body?.theme;

    if (!isPlainObject(theme)) {
      res.status(400).json({ error: "Expected a theme object" });
      return;
    }
    if (Buffer.byteLength(JSON.stringify(theme), "utf8") > MAX_THEME_BYTES) {
      res.status(413).json({ error: "Theme is too large" });
      return;
    }

    const doc = await SiteTheme.findOneAndUpdate(
      { key: "site" },
      {
        $set: {
          theme,
          updatedBy: typeof body.updatedBy === "string" ? body.updatedBy.slice(0, 80) : "",
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    res.json({ theme: doc?.theme ?? {}, updatedAt: doc?.updatedAt });
  }),
);

/** DELETE /api/theme, go back to the shipped defaults. */
themeRouter.delete(
  "/",
  asyncHandler(async (_req, res) => {
    await SiteTheme.findOneAndUpdate(
      { key: "site" },
      { $set: { theme: {}, updatedBy: "" } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    res.json({ theme: {} });
  }),
);
