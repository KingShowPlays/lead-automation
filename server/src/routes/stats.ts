import { Router } from "express";
import { z } from "zod";
import { Lead } from "../models/Lead.js";
import { OutreachLog } from "../models/OutreachLog.js";
import { SearchRun } from "../models/SearchRun.js";
import { asyncHandler } from "../middleware/index.js";
import { integrationStatus } from "../config/runtime.js";
import { getSettings } from "../models/Settings.js";

export const statsRouter = Router();

const toMap = (rows: Array<{ _id: string | null; count: number }>) =>
  Object.fromEntries(rows.map((row) => [row._id ?? "UNKNOWN", row.count]));

function scoreBuckets(values: number[]): Record<string, number> {
  const buckets = { "0–24": 0, "25–49": 0, "50–74": 0, "75–100": 0 };
  for (const value of values) {
    if (value < 25) buckets["0–24"]++;
    else if (value < 50) buckets["25–49"]++;
    else if (value < 75) buckets["50–74"]++;
    else buckets["75–100"]++;
  }
  return buckets;
}

/** GET /api/stats/analytics, decision-grade quality, recency and channel analytics. */
statsRouter.get(
  "/analytics",
  asyncHandler(async (req, res) => {
    const { days } = z
      .object({ days: z.union([z.coerce.number().int().min(1).max(3650), z.literal("all")]).default(30) })
      .parse(req.query);
    const now = new Date();
    const from = days === "all" ? null : new Date(now.getTime() - days * 86_400_000);
    const scope: Record<string, unknown> = {
      optedOut: { $ne: true },
      ...(from ? { createdAt: { $gte: from } } : {}),
    };
    const settings = await getSettings();
    const qualifiedNeed = {
      $or: [
        { needScore: { $gte: settings.scoreThreshold } },
        { needScore: { $exists: false }, leadScore: { $gte: settings.scoreThreshold } },
      ],
    };
    const contactable = [
      { email: { $nin: [null, ""] } },
      { phoneNormalized: { $nin: [null, ""] } },
      { instagramUsername: { $nin: [null, ""] } },
    ];
    const noContact = {
      email: { $in: [null, ""] },
      phoneNormalized: { $in: [null, ""] },
      instagramUsername: { $in: [null, ""] },
    };

    const [
      total,
      qualified,
      newBusinesses,
      emergingBusinesses,
      newToGoogle,
      openingSoon,
      risingActivity,
      contactableAny,
      contactableNone,
      withEmail,
      withPhone,
      withWhatsapp,
      withInstagram,
      contacted,
      interested,
      converted,
      revenue,
      byMaturity,
      bySource,
      byCity,
      byCategory,
      byWebsiteType,
      scoreRows,
      recentRuns,
    ] = await Promise.all([
      Lead.countDocuments(scope),
      Lead.countDocuments({ ...scope, ...qualifiedNeed }),
      Lead.countDocuments({ ...scope, maturity: "NEW" }),
      Lead.countDocuments({ ...scope, maturity: "EMERGING" }),
      Lead.countDocuments({ ...scope, newToGoogle: true }),
      Lead.countDocuments({ ...scope, openingSoon: true }),
      Lead.countDocuments({ ...scope, ratingVelocity: { $gte: 2 } }),
      Lead.countDocuments({ ...scope, $or: contactable }),
      Lead.countDocuments({ ...scope, ...noContact }),
      Lead.countDocuments({ ...scope, email: { $nin: [null, ""] } }),
      Lead.countDocuments({ ...scope, phoneNormalized: { $nin: [null, ""] } }),
      Lead.countDocuments({ ...scope, whatsappAvailable: true }),
      Lead.countDocuments({ ...scope, instagramUsername: { $nin: [null, ""] } }),
      Lead.countDocuments({ ...scope, outreachStatus: { $in: ["CONTACTED", "FOLLOW_UP_SENT", "RESPONDED", "INTERESTED", "NOT_INTERESTED", "CONVERTED"] } }),
      Lead.countDocuments({ ...scope, outreachStatus: { $in: ["INTERESTED", "CONVERTED"] } }),
      Lead.countDocuments({ ...scope, outreachStatus: "CONVERTED" }),
      Lead.aggregate([
        { $match: { ...scope, outreachStatus: "CONVERTED", estimatedDealValue: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: "$estimatedDealValue" } } },
      ]),
      Lead.aggregate([{ $match: scope }, { $group: { _id: "$maturity", count: { $sum: 1 } } }]),
      Lead.aggregate([{ $match: scope }, { $group: { _id: "$discoverySource", count: { $sum: 1 } } }]),
      Lead.aggregate([{ $match: scope }, { $group: { _id: "$city", count: { $sum: 1 } } }]),
      Lead.aggregate([{ $match: scope }, { $group: { _id: "$category", count: { $sum: 1 } } }]),
      Lead.aggregate([{ $match: scope }, { $group: { _id: "$websiteType", count: { $sum: 1 } } }]),
      Lead.find(scope).select("leadScore needScore reachScore priorityScore").lean(),
      SearchRun.find(from ? { startedAt: { $gte: from } } : {}).sort({ startedAt: -1 }).limit(100).lean(),
    ]);

    const average = (values: number[]) =>
      values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
    const needValues = scoreRows.map((row) => row.needScore ?? row.leadScore ?? 0);
    const reachValues = scoreRows.map((row) => row.reachScore ?? 0);
    const priorityValues = scoreRows.map(
      (row, index) => row.priorityScore ?? Math.round(needValues[index] * 0.75 + reachValues[index] * 0.25),
    );

    res.json({
      window: {
        days,
        label: days === "all" ? "All time" : `Last ${days} days`,
        from: from?.toISOString() ?? null,
        to: now.toISOString(),
      },
      qualificationThreshold: settings.scoreThreshold,
      totals: {
        total,
        qualified,
        newBusinesses,
        emergingBusinesses,
        newToGoogle,
        openingSoon,
        risingActivity,
        contactableAny,
        contactableNone,
        contacted,
        interested,
        converted,
      },
      revenue: { totalDealValue: revenue[0]?.total ?? 0, convertedDeals: converted },
      contactability: {
        email: withEmail,
        phone: withPhone,
        whatsapp: withWhatsapp,
        instagram: withInstagram,
        any: contactableAny,
        none: contactableNone,
      },
      scores: {
        averageNeed: average(needValues),
        averageReach: average(reachValues),
        averagePriority: average(priorityValues),
        needBuckets: scoreBuckets(needValues),
        reachBuckets: scoreBuckets(reachValues),
      },
      byMaturity: toMap(byMaturity),
      bySource: toMap(bySource),
      byCity: toMap(byCity),
      byCategory: toMap(byCategory),
      byWebsiteType: toMap(byWebsiteType),
      recentRuns,
    });
  }),
);

/** GET /api/stats, dashboard funnel + revenue tracking. */
statsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const status = await integrationStatus();
    const settings = await getSettings();
    const [byStage, byWebsiteType, byCity, byOutreach, bySource, totals, revenue, convertedDealsCount, queueByChannel, recentRuns, recentActivity] =
      await Promise.all([
        Lead.aggregate([{ $group: { _id: "$pipelineStage", count: { $sum: 1 } } }]),
        Lead.aggregate([{ $group: { _id: "$websiteType", count: { $sum: 1 } } }]),
        Lead.aggregate([{ $group: { _id: "$city", count: { $sum: 1 } } }]),
        Lead.aggregate([{ $group: { _id: "$outreachStatus", count: { $sum: 1 } } }]),
        Lead.aggregate([{ $group: { _id: "$discoverySource", count: { $sum: 1 } } }]),
        Promise.all([
          Lead.countDocuments(),
          Lead.countDocuments({ "approval.status": "PENDING" }),
          Lead.countDocuments({ outreachStatus: "CONTACTED" }),
          Lead.countDocuments({ outreachStatus: "INTERESTED" }),
          Lead.countDocuments({ outreachStatus: "CONVERTED" }),
          Lead.countDocuments({ optedOut: true }),
        ]),
        // Sum of deal values (aggregation). The count of deals is taken from a
        // separate countDocuments below, keeping this portable across
        // Mongo-compatible backends that don't implement $cond / constant $sum.
        Lead.aggregate([
          { $match: { outreachStatus: "CONVERTED", estimatedDealValue: { $gt: 0 } } },
          { $group: { _id: null, total: { $sum: "$estimatedDealValue" } } },
        ]),
        Lead.countDocuments({ outreachStatus: "CONVERTED", estimatedDealValue: { $gt: 0 } }),
        // How the approval queue splits by channel. Without this the queue's
        // filter buttons look broken when one of them is legitimately empty:
        // the operator presses Email, sees nothing, and concludes the button
        // does not work rather than that no lead has an address.
        Lead.aggregate([
          { $match: { "approval.status": "PENDING", pipelineStage: { $in: ["PENDING_APPROVAL", "APPROVED"] } } },
          { $group: { _id: "$outreachChannel", count: { $sum: 1 } } },
        ]),
        SearchRun.find().sort({ startedAt: -1 }).limit(5).lean(),
        OutreachLog.find().sort({ createdAt: -1 }).limit(15).populate("leadId", "businessName city").lean(),
      ]);

    const [total, pendingApproval, contacted, interested, converted, optedOut] = totals;

    res.json({
      totals: { total, pendingApproval, contacted, interested, converted, optedOut },
      revenue: {
        totalDealValue: revenue[0]?.total ?? 0,
        convertedDeals: convertedDealsCount,
      },
      byStage: toMap(byStage),
      byWebsiteType: toMap(byWebsiteType),
      byCity: toMap(byCity),
      byOutreachStatus: toMap(byOutreach),
      bySource: toMap(bySource),
      queueByChannel: toMap(queueByChannel),
      onboardedAt: settings.onboardedAt,
      recentRuns,
      recentActivity,
      integrations: {
        googlePlaces: status.googlePlaces.configured,
        ai: status.ai.configured,
        aiProvider: status.ai.provider,
        email: status.email.configured,
        emailProvider: status.email.provider,
        // kept for older dashboard builds
        gmail: status.email.configured && status.email.provider === "gmail",
        authEnabled: status.authEnabled,
      },
    });
  }),
);
