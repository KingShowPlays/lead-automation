import { DEFAULT_COUNTRY, isLikelyMobile, normalizePhone } from "../../utils/phone.js";
import type { LeadDocument } from "../../models/Lead.js";
import type { OutreachChannel } from "../../types.js";

interface ContactRoutes {
  email?: string | null;
  instagramUsername?: string | null;
  whatsappAvailable?: boolean;
  phone?: string | null;
  phoneNormalized?: string | null;
}

/**
 * Whether this business can be reached on WhatsApp.
 *
 * Derived from the number rather than read from the stored flag. That flag was
 * only ever set inside enrichment's "normalise the phone" branch, which is
 * skipped when discovery already normalised it, which discovery always does for
 * a Google Places lead. So the flag stayed false for every Places lead, and
 * hundreds of businesses with a perfectly good mobile number came out with no
 * contact route at all. A Nigerian mobile prefix is the evidence; the flag is
 * only a cache of it.
 */
export function whatsappReachable(lead: ContactRoutes): boolean {
  if (lead.whatsappAvailable) return Boolean(lead.phoneNormalized ?? lead.phone);
  // phoneNormalized is written at discovery with the configured country;
  // this fallback only covers a lead stored before that ran.
  const normalized = lead.phoneNormalized ?? (lead.phone ? normalizePhone(lead.phone, DEFAULT_COUNTRY) : null);
  return isLikelyMobile(normalized);
}

/**
 * How a lead will actually be contacted.
 *
 * This used to be decided inline in three places, all of them written as
 * `email ? EMAIL : instagram ? INSTAGRAM_MANUAL : EMAIL`. That final EMAIL was
 * wrong twice over: a business reachable only on WhatsApp was never offered as
 * a WhatsApp lead, and a business with no route at all was marked as an email
 * lead with no address, so it sat in the queue looking actionable and could
 * never be sent. The dashboard then labelled both of them "Instagram DM",
 * because it inferred the channel from "not a working email" rather than
 * reading it.
 *
 * The order is deliberate. Email is the only channel the system can dispatch
 * itself; Instagram and WhatsApp are handed to a human with the message ready;
 * NONE is the honest answer for a lead with nothing but a landline.
 */
export function preferredChannel(lead: ContactRoutes): OutreachChannel {
  if (lead.email) return "EMAIL";
  if (lead.instagramUsername) return "INSTAGRAM_MANUAL";
  if (whatsappReachable(lead)) return "WHATSAPP";
  return "NONE";
}

/** Every way this business could be reached, not only the one that will be used. */
export function contactRoutes(lead: ContactRoutes): Array<"EMAIL" | "INSTAGRAM" | "WHATSAPP" | "PHONE"> {
  const routes: Array<"EMAIL" | "INSTAGRAM" | "WHATSAPP" | "PHONE"> = [];
  if (lead.email) routes.push("EMAIL");
  if (lead.instagramUsername) routes.push("INSTAGRAM");
  if (whatsappReachable(lead)) routes.push("WHATSAPP");
  if (lead.phone || lead.phoneNormalized) routes.push("PHONE");
  return routes;
}

/** Sets the channel and keeps the WhatsApp flag in step with the number. */
export function assignChannel(lead: LeadDocument): OutreachChannel {
  if (!lead.whatsappAvailable && whatsappReachable(lead)) lead.whatsappAvailable = true;
  lead.outreachChannel = preferredChannel(lead);
  return lead.outreachChannel;
}

/** True when the channel can actually carry a message today. */
export function channelIsReachable(lead: ContactRoutes & { outreachChannel: OutreachChannel }): boolean {
  switch (lead.outreachChannel) {
    case "EMAIL":
      return Boolean(lead.email);
    case "INSTAGRAM_MANUAL":
      return Boolean(lead.instagramUsername);
    case "WHATSAPP":
      return whatsappReachable(lead);
    default:
      return false;
  }
}

/** Human wording for the channel, used in prompts and in the interface. */
export const CHANNEL_LABELS: Record<OutreachChannel, string> = {
  EMAIL: "email",
  INSTAGRAM_MANUAL: "Instagram DM",
  WHATSAPP: "WhatsApp message",
  NONE: "message",
};
