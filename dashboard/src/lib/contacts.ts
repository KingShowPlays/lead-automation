import type { Lead } from "./types";

/**
 * Which routes exist into a business, worked out from the lead itself.
 *
 * Deliberately derived here rather than read from `outreachChannel`. That field
 * records the one route outreach will use; it is a single value, it is written
 * at scoring time, and a lead scored under an older rule can be holding an
 * answer nobody would give today. The chips in the queue have to tell the truth
 * about what is on the record right now, so they are computed from the contact
 * fields every render.
 */

export type ContactRoute = "EMAIL" | "INSTAGRAM" | "WHATSAPP" | "PHONE";

/** Nigerian mobile prefixes, in the +234 form the pipeline stores. */
const NG_MOBILE = /^(70|701|702|703|704|705|706|707|708|709|71|80|801|802|803|804|805|806|807|808|809|81|810|811|812|813|814|815|816|817|818|819|90|901|902|903|904|905|906|907|908|909|91|911|912|913|914|915|916|917|918)/;

function normalise(phone: string | undefined | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+234")) return digits;
  if (digits.startsWith("234")) return `+${digits}`;
  if (digits.startsWith("0") && digits.length >= 11) return `+234${digits.slice(1)}`;
  return null;
}

/** A Nigerian mobile number is a WhatsApp number in all but a few cases. */
export function whatsappNumber(lead: Pick<Lead, "phone" | "phoneNormalized" | "whatsappAvailable">): string | null {
  const number = lead.phoneNormalized ?? normalise(lead.phone);
  if (!number) return null;
  if (lead.whatsappAvailable) return number;
  return NG_MOBILE.test(number.slice(4)) ? number : null;
}

export function contactRoutes(lead: Lead): ContactRoute[] {
  const routes: ContactRoute[] = [];
  if (lead.email) routes.push("EMAIL");
  if (lead.instagramUsername) routes.push("INSTAGRAM");
  if (whatsappNumber(lead)) routes.push("WHATSAPP");
  if (lead.phone || lead.phoneNormalized) routes.push("PHONE");
  return routes;
}

export const CHANNEL_LABELS: Record<Lead["outreachChannel"], string> = {
  EMAIL: "Email",
  INSTAGRAM_MANUAL: "Instagram DM",
  WHATSAPP: "WhatsApp",
  NONE: "No contact route",
};

/** What to call the message being edited, given the channel it will go out on. */
export const MESSAGE_LABELS: Record<Lead["outreachChannel"], string> = {
  EMAIL: "Email message",
  INSTAGRAM_MANUAL: "Instagram DM",
  WHATSAPP: "WhatsApp message",
  NONE: "Message, once a contact route is found",
};

/** A wa.me link that opens the chat with the message already typed. */
export function whatsappLink(lead: Lead, message: string): string | null {
  const number = whatsappNumber(lead);
  if (!number) return null;
  return `https://wa.me/${number.replace("+", "")}?text=${encodeURIComponent(message)}`;
}
