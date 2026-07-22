import { google, type gmail_v1 } from "googleapis";
import { config, integrations } from "../../config/index.js";
import { logger } from "../../utils/logger.js";
import { OutreachLog } from "../../models/OutreachLog.js";
import type { LeadDocument } from "../../models/Lead.js";

/**
 * Gmail integration: create drafts for approved leads, send them,
 * and log everything. Every outgoing email carries a polite decline
 * line (NDPA right-to-object) — non-negotiable.
 */

export const COMPLIANCE_FOOTER =
  "\n\n—\nYEAN Technologies · Custom websites for Nigerian businesses\n" +
  "We found your business through its public listing. " +
  "If you'd rather not hear from us again, just reply \"unsubscribe\" and we won't contact you further.";

let gmailClient: gmail_v1.Gmail | null = null;

export function getGmail(): gmail_v1.Gmail {
  if (!integrations.gmailConfigured) {
    throw new Error("Gmail is not configured. Set GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN/SENDER.");
  }
  if (!gmailClient) {
    const oauth2 = new google.auth.OAuth2(config.GMAIL_CLIENT_ID, config.GMAIL_CLIENT_SECRET);
    oauth2.setCredentials({ refresh_token: config.GMAIL_REFRESH_TOKEN });
    gmailClient = google.gmail({ version: "v1", auth: oauth2 });
  }
  return gmailClient;
}

/** For tests. */
export function _setGmailClient(client: gmail_v1.Gmail | null): void {
  gmailClient = client;
}

/** Builds an RFC 2822 message, base64url-encoded as the Gmail API expects. */
export function buildRawEmail(opts: { to: string; subject: string; body: string; from?: string; fromName?: string }): string {
  const from = opts.from ?? config.GMAIL_SENDER;
  const fromName = opts.fromName ?? config.GMAIL_SENDER_NAME;
  // RFC 2047 encode the subject in case of non-ASCII characters.
  const encodedSubject = /^[\x20-\x7E]*$/.test(opts.subject)
    ? opts.subject
    : `=?UTF-8?B?${Buffer.from(opts.subject, "utf8").toString("base64")}?=`;

  const lines = [
    `From: ${fromName} <${from}>`,
    `To: ${opts.to}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(opts.body, "utf8").toString("base64"),
  ];
  return Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
}

/** Creates a Gmail draft for an approved lead. Returns the draft id. */
export async function createDraftForLead(lead: LeadDocument): Promise<{ draftId: string; messageId?: string }> {
  if (!lead.email) throw new Error(`Lead ${lead.businessName} has no email address`);
  if (!lead.pitchSubject || !lead.pitchMessage) throw new Error(`Lead ${lead.businessName} has no pitch yet`);
  if (lead.optedOut) throw new Error(`Lead ${lead.businessName} has opted out — cannot draft`);

  const gmail = getGmail();
  const raw = buildRawEmail({
    to: lead.email,
    subject: lead.pitchSubject,
    body: lead.pitchMessage + COMPLIANCE_FOOTER,
  });

  const res = await gmail.users.drafts.create({
    userId: "me",
    requestBody: { message: { raw } },
  });

  const draftId = res.data.id;
  if (!draftId) throw new Error("Gmail did not return a draft id");

  await OutreachLog.create({
    leadId: lead._id,
    channel: "EMAIL",
    direction: "OUTBOUND",
    action: "DRAFT_CREATED",
    subject: lead.pitchSubject,
    message: lead.pitchMessage,
    meta: { draftId },
  });

  logger.info({ lead: lead.businessName, draftId }, "Gmail draft created");
  return { draftId, messageId: res.data.message?.id ?? undefined };
}

/** Sends a previously created draft. Returns message/thread ids. */
export async function sendDraft(draftId: string): Promise<{ messageId?: string; threadId?: string }> {
  const gmail = getGmail();
  const res = await gmail.users.drafts.send({
    userId: "me",
    requestBody: { id: draftId },
  });
  return { messageId: res.data.id ?? undefined, threadId: res.data.threadId ?? undefined };
}

/** Sends an email immediately (used for follow-ups). */
export async function sendEmail(opts: { to: string; subject: string; body: string; threadId?: string }): Promise<{
  messageId?: string;
  threadId?: string;
}> {
  const gmail = getGmail();
  const raw = buildRawEmail({ to: opts.to, subject: opts.subject, body: opts.body + COMPLIANCE_FOOTER });
  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw, ...(opts.threadId ? { threadId: opts.threadId } : {}) },
  });
  return { messageId: res.data.id ?? undefined, threadId: res.data.threadId ?? undefined };
}

/** Count of outreach emails sent today (for the daily cap). */
export async function emailsSentToday(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return OutreachLog.countDocuments({
    channel: "EMAIL",
    action: { $in: ["SENT", "FOLLOW_UP_SENT"] },
    createdAt: { $gte: startOfDay },
  });
}
