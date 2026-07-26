/**
 * Re-scores every stored lead with the current model.
 *
 * Run this once after deploying a scoring change. Leads scored under the old
 * model keep their old stage forever otherwise: nothing re-examines a lead that
 * has already been through the pipeline, so a database full of leads wrongly
 * marked DISQUALIFIED stays that way until this is run.
 *
 * It only moves leads between QUALIFIED and DISQUALIFIED. Anything a human has
 * already touched, approved, rejected, contacted or converted, is left exactly
 * as it is.
 *
 *   npm run rescore --workspace server
 *   npm run rescore --workspace server -- --dry
 */
import mongoose from "mongoose";
import { config } from "../config/index.js";
import { Lead } from "../models/Lead.js";
import { getSettings } from "../models/Settings.js";
import { scoreLead, maturityOf, type Maturity } from "../services/scoring/leadScore.js";
import { applyPitchResult, generatePitch, pitchContextFromLead } from "../services/pitch/generatePitch.js";
import { logger } from "../utils/logger.js";

/** Stages owned by a person. Re-scoring must never disturb these. */
const HUMAN_OWNED = new Set(["PENDING_APPROVAL", "APPROVED", "REJECTED", "CONTACTED", "ARCHIVED"]);

const dryRun = process.argv.includes("--dry");
/** Generating pitches for thousands of leads costs money, so it is opt-in. */
const withPitches = process.argv.includes("--pitches");

async function main(): Promise<void> {
  await mongoose.connect(config.MONGODB_URI);
  const settings = await getSettings();

  const total = await Lead.countDocuments({});
  const moved = { qualified: 0, disqualified: 0, unchanged: 0, skipped: 0 };

  const cursor = Lead.find({}).cursor();
  for await (const lead of cursor) {
    if (HUMAN_OWNED.has(lead.pipelineStage) || lead.optedOut) {
      moved.skipped++;
      continue;
    }

    const maturity = maturityOf(lead.userRatingCount, lead.openingSoon);
    const result = scoreLead(
      {
        websiteType: lead.websiteType,
        hasEmail: Boolean(lead.email),
        hasPhone: Boolean(lead.phoneNormalized ?? lead.phone),
        whatsappAvailable: lead.whatsappAvailable,
        openingSoon: lead.openingSoon,
        instagramActive: lead.instagramActive,
        strongVisualBrand: lead.strongVisualBrand,
        maturity: maturity as Maturity,
        rating: lead.rating,
        userRatingCount: lead.userRatingCount,
        ratingVelocity: lead.ratingVelocity,
        newToGoogle: lead.newToGoogle,
      },
      settings.scoringWeights,
      settings.scoreThreshold,
    );

    const nextStage = result.qualified ? "QUALIFIED" : "DISQUALIFIED";
    if (nextStage === lead.pipelineStage && lead.needScore === result.needScore) {
      moved.unchanged++;
      continue;
    }

    if (!dryRun) {
      lead.leadScore = result.needScore;
      lead.needScore = result.needScore;
      lead.reachScore = result.reachScore;
      lead.priorityScore = result.priorityScore;
      lead.scoreBreakdown = result.breakdown;
      lead.needBreakdown = result.needBreakdown;
      lead.reachBreakdown = result.reachBreakdown;
      lead.maturity = maturity;
      lead.scoredAt = new Date();
      lead.pipelineStage = nextStage;

      // A newly qualified lead needs a pitch before it can enter the queue.
      if (result.qualified && withPitches && !lead.pitchMessage) {
        lead.outreachChannel = lead.email ? "EMAIL" : lead.instagramUsername ? "INSTAGRAM_MANUAL" : "EMAIL";
        const pitch = await generatePitch(pitchContextFromLead(lead));
        applyPitchResult(lead, pitch);
        lead.pipelineStage = "PENDING_APPROVAL";
        lead.approval.status = "PENDING";
      }
      await lead.save();
    }

    if (result.qualified) moved.qualified++;
    else moved.disqualified++;
  }

  logger.info({ total, ...moved, dryRun, withPitches }, "rescore complete");
  console.log(
    `\n${dryRun ? "Would re-score" : "Re-scored"} ${total} leads:\n` +
      `  now qualified     ${moved.qualified}\n` +
      `  now disqualified  ${moved.disqualified}\n` +
      `  unchanged         ${moved.unchanged}\n` +
      `  left alone        ${moved.skipped}  (already approved, contacted or opted out)\n` +
      (withPitches ? "" : "\nRun again with --pitches to draft pitches and fill the approval queue.\n"),
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  logger.error({ err: err instanceof Error ? err.message : String(err) }, "rescore failed");
  process.exit(1);
});
