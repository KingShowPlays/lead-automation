import mongoose, { Schema, type Document, type Model } from "mongoose";

/**
 * Append-only audit log of every outreach action.
 * This is the CRM trail: drafts, sends, follow-ups, replies, opt-outs.
 */
export interface OutreachLogDocument extends Document {
  leadId: mongoose.Types.ObjectId;
  channel: "EMAIL" | "INSTAGRAM_MANUAL" | "WHATSAPP" | "SYSTEM";
  direction: "OUTBOUND" | "INBOUND" | "INTERNAL";
  action:
    | "DRAFT_CREATED"
    | "SENT"
    | "FOLLOW_UP_SENT"
    | "MARKED_CONTACTED"
    | "RESPONSE_RECEIVED"
    | "OPT_OUT"
    | "BOUNCED"
    | "APPROVED"
    | "REJECTED"
    | "CONVERTED"
    | "NOTE";
  subject?: string;
  message?: string;
  meta?: Record<string, unknown>;
  createdAt: Date;
}

const outreachLogSchema = new Schema<OutreachLogDocument>(
  {
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    channel: { type: String, enum: ["EMAIL", "INSTAGRAM_MANUAL", "WHATSAPP", "SYSTEM"], required: true },
    direction: { type: String, enum: ["OUTBOUND", "INBOUND", "INTERNAL"], required: true },
    action: {
      type: String,
      enum: [
        "DRAFT_CREATED",
        "SENT",
        "FOLLOW_UP_SENT",
        "MARKED_CONTACTED",
        "RESPONSE_RECEIVED",
        "OPT_OUT",
        "BOUNCED",
        "APPROVED",
        "REJECTED",
        "CONVERTED",
        "NOTE",
      ],
      required: true,
    },
    subject: String,
    message: String,
    meta: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

outreachLogSchema.index({ createdAt: -1 });

export const OutreachLog: Model<OutreachLogDocument> =
  (mongoose.models.OutreachLog as Model<OutreachLogDocument>) ??
  mongoose.model<OutreachLogDocument>("OutreachLog", outreachLogSchema);
