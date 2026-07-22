import { Router } from "express";
import { Lead } from "../models/Lead.js";
import { OutreachLog } from "../models/OutreachLog.js";
import { SearchRun } from "../models/SearchRun.js";
import { asyncHandler } from "../middleware/index.js";
import { integrations } from "../config/index.js";

export const statsRouter = Router();

/** GET /api/stats — dashboard funnel + revenue tracking. */
statsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [byStage, byWebsiteType, byCity, byOutreach, totals, revenue, recentRuns, recentActivity] =
      await Promise.all([
        Lead.aggregate([{ $group: { _id: "$pipelineStage", count: { $sum: 1 } } }]),
        Lead.aggregate([{ $group: { _id: "$websiteType", count: { $sum: 1 } } }]),
        Lead.aggregate([{ $group: { _id: "$city", count: { $sum: 1 } } }]),
        Lead.aggregate([{ $group: { _id: "$outreachStatus", count: { $sum: 1 } } }]),
        Promise.all([
          Lead.countDocuments(),
          Lead.countDocuments({ "approval.status": "PENDING" }),
          Lead.countDocuments({ outreachStatus: "CONTACTED" }),
          Lead.countDocuments({ outreachStatus: "INTERESTED" }),
          Lead.countDocuments({ outreachStatus: "CONVERTED" }),
          Lead.countDocuments({ optedOut: true }),
        ]),
        Lead.aggregate([
          { $match: { outreachStatus: "CONVERTED", estimatedDealValue: { $gt: 0 } } },
          { $group: { _id: null, total: { $sum: "$estimatedDealValue" }, count: { $sum: 1 } } },
        ]),
        SearchRun.find().sort({ startedAt: -1 }).limit(5).lean(),
        OutreachLog.find().sort({ createdAt: -1 }).limit(15).populate("leadId", "businessName city").lean(),
      ]);

    const toMap = (rows: Array<{ _id: string; count: number }>) =>
      Object.fromEntries(rows.map((r) => [r._id ?? "UNKNOWN", r.count]));

    const [total, pendingApproval, contacted, interested, converted, optedOut] = totals;

    res.json({
      totals: { total, pendingApproval, contacted, interested, converted, optedOut },
      revenue: {
        totalDealValue: revenue[0]?.total ?? 0,
        convertedDeals: revenue[0]?.count ?? 0,
      },
      byStage: toMap(byStage),
      byWebsiteType: toMap(byWebsiteType),
      byCity: toMap(byCity),
      byOutreachStatus: toMap(byOutreach),
      recentRuns,
      recentActivity,
      integrations: {
        googlePlaces: integrations.placesConfigured,
        ai: integrations.aiConfigured,
        gmail: integrations.gmailConfigured,
        authEnabled: integrations.authEnabled,
      },
    });
  }),
);
