/**
 * The site theme: every visual decision the interface makes, as data.
 *
 * One object drives colour, corner radius, borders, type, density, motion,
 * effects, ordering and brand. It is stored on the server, rendered into the
 * document as CSS custom properties before the first paint, and edited live
 * from /site-control.
 *
 * Two rules keep the system honest:
 *
 *  1. Nothing here is applied by React re-rendering the page. The tokens become
 *     one stylesheet and a handful of attributes on <html>, so a change repaints
 *     without remounting anything. That is what stops the flicker.
 *  2. Every field has a default. A theme loaded from an older version of the
 *     app, or from a failed request, still resolves to something complete.
 */

import {
  accentRamp,
  contrastRatio,
  hexToRgb,
  hexToTriplet,
  neutralRamp,
  RAMP_SHADES,
  readableInk,
  rgbToHsl,
} from "./color";

/* ------------------------------------------------------------------ */
/* Shape                                                               */
/* ------------------------------------------------------------------ */

export const FONT_KEYS = ["grotesk", "sans", "archivo", "mono", "serif", "system"] as const;
export type FontKey = (typeof FONT_KEYS)[number];

export const FONT_LABELS: Record<FontKey, string> = {
  grotesk: "Space Grotesk",
  sans: "DM Sans",
  archivo: "Archivo",
  mono: "Azeret Mono",
  serif: "Serif",
  system: "System UI",
};

export const EASING_KEYS = ["expo", "quint", "standard", "spring", "linear"] as const;
export type EasingKey = (typeof EASING_KEYS)[number];

export const EASING_CURVES: Record<EasingKey, string> = {
  expo: "cubic-bezier(0.16, 1, 0.3, 1)",
  quint: "cubic-bezier(0.83, 0, 0.17, 1)",
  standard: "cubic-bezier(0.4, 0, 0.2, 1)",
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  linear: "linear",
};

export const EASING_LABELS: Record<EasingKey, string> = {
  expo: "Expo, long and settled",
  quint: "Quint, sharp both ends",
  standard: "Standard, neutral",
  spring: "Spring, slight overshoot",
  linear: "Linear, mechanical",
};

/** Surface and ink colours, which flip between light and dark. */
export interface Palette {
  canvas: string;
  surface: string;
  surfaceMuted: string;
  line: string;
  ink: string;
  inkMuted: string;
  accent: string;
  accentInk: string;
  positive: string;
  warning: string;
  danger: string;
  info: string;
  highlight: string;
}

export interface RadiusTokens {
  /** When on, every corner follows `base` and the per part values are ignored. */
  linked: boolean;
  base: number;
  card: number;
  control: number;
  input: number;
  badge: number;
  pill: number;
}

export interface BorderTokens {
  width: number;
  strongWidth: number;
  accentBar: number;
  focusWidth: number;
  style: "solid" | "dashed" | "dotted";
  /** 0-100. Fades the hairline toward the surface it sits on. */
  softness: number;
}

export interface TypographyTokens {
  heading: FontKey;
  body: FontKey;
  mono: FontKey;
  scale: number;
  headingWeight: number;
  headingTracking: number;
  bodyLineHeight: number;
  labelCaps: boolean;
  labelTracking: number;
  displaySize: number;
}

export interface DensityTokens {
  scale: number;
  gutter: number;
  cardPadding: number;
  controlHeight: number;
  rowHeight: number;
  metricHeight: number;
  sidebarWidth: number;
  maxWidth: number;
}

export interface MotionTokens {
  enabled: boolean;
  intensity: number;
  speed: number;
  easing: EasingKey;
  reveal: boolean;
  stagger: boolean;
  hover: boolean;
  magnetic: boolean;
  pageTransition: boolean;
  counters: boolean;
  marquee: boolean;
  cursor: boolean;
  smoothScroll: boolean;
  parallax: boolean;
  pulse: boolean;
  underline: boolean;
}

export interface EffectTokens {
  shadow: number;
  gridTexture: boolean;
  noise: boolean;
  gradients: boolean;
  glass: boolean;
  glow: boolean;
  scanlines: boolean;
  vignette: boolean;
}

export interface LayoutTokens {
  navOrder: string[];
  navHidden: string[];
  sectionOrder: string[];
  sectionHidden: string[];
  metricOrder: string[];
  metricHidden: string[];
  sidebar: "left" | "right";
  header: "sticky" | "static";
}

export interface BrandTokens {
  productName: string;
  wordmark: string;
  wordmarkAccent: string;
  showWordmark: boolean;
  logo: "framed" | "mark" | "none";
  tagline: string;
}

export interface NeutralTokens {
  hue: number;
  saturation: number;
}

export interface Theme {
  version: number;
  preset: string;
  mode: "light" | "dark" | "system";
  neutral: NeutralTokens;
  light: Palette;
  dark: Palette;
  radius: RadiusTokens;
  border: BorderTokens;
  typography: TypographyTokens;
  density: DensityTokens;
  motion: MotionTokens;
  effects: EffectTokens;
  layout: LayoutTokens;
  brand: BrandTokens;
}

export const THEME_VERSION = 1;

/* ------------------------------------------------------------------ */
/* Registries the ordering controls edit                               */
/* ------------------------------------------------------------------ */

/** Navigation entries, in shipped order. Ids are stable across versions. */
export const NAV_ITEMS = [
  { id: "overview", label: "Overview" },
  { id: "analytics", label: "Analytics" },
  { id: "queue", label: "Approval queue" },
  { id: "leads", label: "All leads" },
  { id: "suppression", label: "Suppression" },
  { id: "site-control", label: "Theme control" },
  { id: "settings", label: "Settings" },
  { id: "help", label: "Help" },
] as const;

/** Overview page sections, with the column span each takes on a wide screen. */
export const SECTION_ITEMS = [
  { id: "metrics", label: "Headline metrics", span: 12 },
  { id: "funnel", label: "Pipeline funnel", span: 7 },
  { id: "attention", label: "Needs attention", span: 5 },
  { id: "discovery", label: "Discovery pulse", span: 4 },
  { id: "website-mix", label: "Website opportunity mix", span: 4 },
  { id: "integrations", label: "Integration health", span: 4 },
  { id: "activity", label: "Recent outreach activity", span: 12 },
] as const;

/** Headline metric cards. */
export const METRIC_ITEMS = [
  { id: "pending", label: "Awaiting approval" },
  { id: "contacted", label: "Contacted" },
  { id: "interested", label: "Interested" },
  { id: "revenue", label: "Revenue won" },
] as const;

const NAV_IDS = NAV_ITEMS.map((n) => n.id) as unknown as string[];
const SECTION_IDS = SECTION_ITEMS.map((s) => s.id) as unknown as string[];
const METRIC_IDS = METRIC_ITEMS.map((m) => m.id) as unknown as string[];

/* ------------------------------------------------------------------ */
/* Default theme: black, white, forest green                           */
/* ------------------------------------------------------------------ */

/** Sampled from the brand mark. */
export const BRAND_GREEN = "#17a34a";
export const BRAND_GREEN_DARK = "#2fbf63";

export const DEFAULT_THEME: Theme = {
  version: THEME_VERSION,
  preset: "mono",
  mode: "light",
  neutral: { hue: 145, saturation: 0 },
  light: {
    canvas: "#ffffff",
    surface: "#ffffff",
    surfaceMuted: "#f4f4f4",
    line: "#d8d8d8",
    ink: "#0a0a0a",
    inkMuted: "#5c5c5c",
    accent: BRAND_GREEN,
    accentInk: "#ffffff",
    positive: "#17a34a",
    warning: "#b45309",
    danger: "#c02626",
    info: "#0f766e",
    highlight: "#0a0a0a",
  },
  dark: {
    canvas: "#000000",
    surface: "#0d0d0d",
    surfaceMuted: "#171717",
    line: "#2b2b2b",
    ink: "#f5f5f5",
    inkMuted: "#a1a1a1",
    accent: BRAND_GREEN_DARK,
    accentInk: "#04140a",
    positive: "#2fbf63",
    warning: "#e0a33a",
    danger: "#ef5757",
    info: "#3ec2b4",
    highlight: "#ffffff",
  },
  radius: { linked: true, base: 0, card: 0, control: 0, input: 0, badge: 0, pill: 999 },
  border: { width: 1, strongWidth: 2, accentBar: 4, focusWidth: 2, style: "solid", softness: 0 },
  typography: {
    heading: "grotesk",
    body: "sans",
    mono: "mono",
    scale: 1,
    headingWeight: 800,
    headingTracking: -0.035,
    bodyLineHeight: 1.6,
    labelCaps: true,
    labelTracking: 0.09,
    displaySize: 1,
  },
  density: {
    scale: 1,
    gutter: 32,
    cardPadding: 24,
    controlHeight: 44,
    rowHeight: 52,
    metricHeight: 152,
    sidebarWidth: 256,
    maxWidth: 0,
  },
  motion: {
    enabled: true,
    intensity: 1,
    speed: 1,
    easing: "expo",
    reveal: true,
    stagger: true,
    hover: true,
    magnetic: false,
    pageTransition: true,
    counters: true,
    marquee: false,
    cursor: false,
    smoothScroll: false,
    parallax: false,
    pulse: true,
    underline: true,
  },
  effects: {
    shadow: 0,
    gridTexture: false,
    noise: false,
    gradients: false,
    glass: false,
    glow: false,
    scanlines: false,
    vignette: false,
  },
  layout: {
    navOrder: [...NAV_IDS],
    navHidden: [],
    sectionOrder: [...SECTION_IDS],
    sectionHidden: [],
    metricOrder: [...METRIC_IDS],
    metricHidden: [],
    sidebar: "left",
    header: "static",
  },
  brand: {
    productName: "YEAN Leads",
    wordmark: "YEAN",
    wordmarkAccent: " Leads",
    showWordmark: true,
    logo: "framed",
    tagline: "Lead operations workspace",
  },
};

/* ------------------------------------------------------------------ */
/* Normalisation                                                       */
/* ------------------------------------------------------------------ */

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const num = (v: unknown, fallback: number, lo: number, hi: number): number => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
};

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === "boolean" ? v : fallback);

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const hex = (v: unknown, fallback: string): string =>
  typeof v === "string" && HEX.test(v.trim()) ? v.trim().toLowerCase() : fallback;

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

/**
 * Reconciles a stored order against the ids this build knows about: keeps the
 * admin's arrangement, drops ids that no longer exist, and appends anything new
 * so a fresh section never goes missing after a deploy.
 */
function order(stored: unknown, known: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  if (Array.isArray(stored)) {
    for (const id of stored) {
      if (typeof id === "string" && known.includes(id) && !seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
  }
  for (const id of known) if (!seen.has(id)) out.push(id);
  return out;
}

function hidden(stored: unknown, known: string[]): string[] {
  if (!Array.isArray(stored)) return [];
  return known.filter((id) => stored.includes(id));
}

function palette(stored: unknown, base: Palette): Palette {
  const s = isRecord(stored) ? stored : {};
  return {
    canvas: hex(s.canvas, base.canvas),
    surface: hex(s.surface, base.surface),
    surfaceMuted: hex(s.surfaceMuted, base.surfaceMuted),
    line: hex(s.line, base.line),
    ink: hex(s.ink, base.ink),
    inkMuted: hex(s.inkMuted, base.inkMuted),
    accent: hex(s.accent, base.accent),
    accentInk: hex(s.accentInk, base.accentInk),
    positive: hex(s.positive, base.positive),
    warning: hex(s.warning, base.warning),
    danger: hex(s.danger, base.danger),
    info: hex(s.info, base.info),
    highlight: hex(s.highlight, base.highlight),
  };
}

/**
 * Turns anything at all into a complete, in-range theme. Every reader of a
 * stored theme goes through here, so a truncated document, a hand edited one,
 * or a response from a future version can never produce a broken interface.
 */
export function normaliseTheme(input: unknown, base: Theme = DEFAULT_THEME): Theme {
  const t = isRecord(input) ? input : {};
  const r = isRecord(t.radius) ? t.radius : {};
  const b = isRecord(t.border) ? t.border : {};
  const ty = isRecord(t.typography) ? t.typography : {};
  const d = isRecord(t.density) ? t.density : {};
  const m = isRecord(t.motion) ? t.motion : {};
  const e = isRecord(t.effects) ? t.effects : {};
  const l = isRecord(t.layout) ? t.layout : {};
  const br = isRecord(t.brand) ? t.brand : {};
  const n = isRecord(t.neutral) ? t.neutral : {};

  const text = (v: unknown, fallback: string, max = 48): string =>
    typeof v === "string" ? v.slice(0, max) : fallback;

  return {
    version: THEME_VERSION,
    preset: text(t.preset, base.preset, 32),
    mode: pick(t.mode, ["light", "dark", "system"] as const, base.mode),
    neutral: {
      hue: num(n.hue, base.neutral.hue, 0, 360),
      saturation: num(n.saturation, base.neutral.saturation, 0, 40),
    },
    light: palette(t.light, base.light),
    dark: palette(t.dark, base.dark),
    radius: {
      linked: bool(r.linked, base.radius.linked),
      base: num(r.base, base.radius.base, 0, 48),
      card: num(r.card, base.radius.card, 0, 48),
      control: num(r.control, base.radius.control, 0, 48),
      input: num(r.input, base.radius.input, 0, 48),
      badge: num(r.badge, base.radius.badge, 0, 48),
      pill: num(r.pill, base.radius.pill, 0, 999),
    },
    border: {
      width: num(b.width, base.border.width, 0, 4),
      strongWidth: num(b.strongWidth, base.border.strongWidth, 0, 8),
      accentBar: num(b.accentBar, base.border.accentBar, 0, 10),
      focusWidth: num(b.focusWidth, base.border.focusWidth, 1, 6),
      style: pick(b.style, ["solid", "dashed", "dotted"] as const, base.border.style),
      softness: num(b.softness, base.border.softness, 0, 100),
    },
    typography: {
      heading: pick(ty.heading, FONT_KEYS, base.typography.heading),
      body: pick(ty.body, FONT_KEYS, base.typography.body),
      mono: pick(ty.mono, FONT_KEYS, base.typography.mono),
      scale: num(ty.scale, base.typography.scale, 0.85, 1.25),
      headingWeight: num(ty.headingWeight, base.typography.headingWeight, 400, 900),
      headingTracking: num(ty.headingTracking, base.typography.headingTracking, -0.08, 0.08),
      bodyLineHeight: num(ty.bodyLineHeight, base.typography.bodyLineHeight, 1.2, 2),
      labelCaps: bool(ty.labelCaps, base.typography.labelCaps),
      labelTracking: num(ty.labelTracking, base.typography.labelTracking, 0, 0.3),
      displaySize: num(ty.displaySize, base.typography.displaySize, 0.8, 1.6),
    },
    density: {
      scale: num(d.scale, base.density.scale, 0.8, 1.35),
      gutter: num(d.gutter, base.density.gutter, 8, 72),
      cardPadding: num(d.cardPadding, base.density.cardPadding, 8, 56),
      controlHeight: num(d.controlHeight, base.density.controlHeight, 32, 64),
      rowHeight: num(d.rowHeight, base.density.rowHeight, 32, 84),
      metricHeight: num(d.metricHeight, base.density.metricHeight, 96, 260),
      sidebarWidth: num(d.sidebarWidth, base.density.sidebarWidth, 180, 380),
      maxWidth: num(d.maxWidth, base.density.maxWidth, 0, 2200),
    },
    motion: {
      enabled: bool(m.enabled, base.motion.enabled),
      intensity: num(m.intensity, base.motion.intensity, 0, 2),
      speed: num(m.speed, base.motion.speed, 0.4, 2.5),
      easing: pick(m.easing, EASING_KEYS, base.motion.easing),
      reveal: bool(m.reveal, base.motion.reveal),
      stagger: bool(m.stagger, base.motion.stagger),
      hover: bool(m.hover, base.motion.hover),
      magnetic: bool(m.magnetic, base.motion.magnetic),
      pageTransition: bool(m.pageTransition, base.motion.pageTransition),
      counters: bool(m.counters, base.motion.counters),
      marquee: bool(m.marquee, base.motion.marquee),
      cursor: bool(m.cursor, base.motion.cursor),
      smoothScroll: bool(m.smoothScroll, base.motion.smoothScroll),
      parallax: bool(m.parallax, base.motion.parallax),
      pulse: bool(m.pulse, base.motion.pulse),
      underline: bool(m.underline, base.motion.underline),
    },
    effects: {
      shadow: num(e.shadow, base.effects.shadow, 0, 3),
      gridTexture: bool(e.gridTexture, base.effects.gridTexture),
      noise: bool(e.noise, base.effects.noise),
      gradients: bool(e.gradients, base.effects.gradients),
      glass: bool(e.glass, base.effects.glass),
      glow: bool(e.glow, base.effects.glow),
      scanlines: bool(e.scanlines, base.effects.scanlines),
      vignette: bool(e.vignette, base.effects.vignette),
    },
    layout: {
      navOrder: order(l.navOrder, NAV_IDS),
      // The theme editor must stay reachable, otherwise hiding it locks the
      // admin out of the only screen that could bring it back.
      navHidden: hidden(l.navHidden, NAV_IDS).filter((id) => id !== "site-control"),
      sectionOrder: order(l.sectionOrder, SECTION_IDS),
      sectionHidden: hidden(l.sectionHidden, SECTION_IDS),
      metricOrder: order(l.metricOrder, METRIC_IDS),
      metricHidden: hidden(l.metricHidden, METRIC_IDS),
      sidebar: pick(l.sidebar, ["left", "right"] as const, base.layout.sidebar),
      header: pick(l.header, ["sticky", "static"] as const, base.layout.header),
    },
    brand: {
      productName: text(br.productName, base.brand.productName, 40),
      wordmark: text(br.wordmark, base.brand.wordmark, 20),
      wordmarkAccent: text(br.wordmarkAccent, base.brand.wordmarkAccent, 20),
      showWordmark: bool(br.showWordmark, base.brand.showWordmark),
      logo: pick(br.logo, ["framed", "mark", "none"] as const, base.brand.logo),
      tagline: text(br.tagline, base.brand.tagline, 80),
    },
  };
}

/* ------------------------------------------------------------------ */
/* CSS emission                                                        */
/* ------------------------------------------------------------------ */

const FONT_STACKS: Record<FontKey, string> = {
  grotesk: "var(--font-space-grotesk), ui-sans-serif, system-ui, sans-serif",
  sans: "var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif",
  archivo: "var(--font-archivo), ui-sans-serif, system-ui, sans-serif",
  mono: "var(--font-azeret-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
  serif: "ui-serif, Georgia, 'Times New Roman', serif",
  system: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};

/** Six elevation steps, keyed by the effects.shadow level. */
const SHADOWS = [
  "none",
  "0 1px 2px rgb(var(--shadow-rgb) / 0.06), 0 1px 1px rgb(var(--shadow-rgb) / 0.04)",
  "0 4px 12px rgb(var(--shadow-rgb) / 0.10), 0 1px 3px rgb(var(--shadow-rgb) / 0.06)",
  "0 18px 44px rgb(var(--shadow-rgb) / 0.18), 0 4px 12px rgb(var(--shadow-rgb) / 0.10)",
];

/** Resolves each corner, honouring the master link toggle. */
export function resolvedRadius(radius: RadiusTokens): Omit<RadiusTokens, "linked"> {
  if (!radius.linked) return { ...radius };
  return {
    base: radius.base,
    card: radius.base,
    control: radius.base,
    input: radius.base,
    badge: radius.base,
    // A pill is a pill: linking corners must not turn avatars and spinners
    // into squares, so this one keeps its own value.
    pill: radius.pill,
  };
}

function paletteVars(p: Palette, neutral: NeutralTokens): string {
  const out: string[] = [];
  const put = (name: string, value: string) => out.push(`--${name}:${value}`);

  put("canvas", hexToTriplet(p.canvas));
  put("page-bg", hexToTriplet(p.canvas));
  put("surface", hexToTriplet(p.surface));
  put("surface-muted", hexToTriplet(p.surfaceMuted));
  put("line", hexToTriplet(p.line));
  put("ink", hexToTriplet(p.ink));
  put("text", hexToTriplet(p.ink));
  put("muted", hexToTriplet(p.inkMuted));
  put("ink-muted", hexToTriplet(p.inkMuted));
  put("accent", hexToTriplet(p.accent));
  put("accent-ink", hexToTriplet(p.accentInk));
  put("highlight", hexToTriplet(p.highlight));
  put("shadow-rgb", hexToTriplet(p.ink));

  // Semantic families, each expanded so the utilities built on them re-tint.
  const families: Array<[string, string]> = [
    ["brand", p.accent],
    ["accent", p.accent],
    ["emerald", p.positive],
    ["green", p.positive],
    ["cta", p.warning],
    ["amber", p.warning],
    ["yellow", p.warning],
    ["orange", p.warning],
    ["rose", p.danger],
    ["red", p.danger],
    ["cyan", p.info],
    ["sky", p.info],
    ["teal", p.info],
    ["purple", p.highlight],
    ["violet", p.highlight],
    ["indigo", p.highlight],
    ["fuchsia", p.highlight],
  ];
  for (const [name, base] of families) {
    const ramp = accentRamp(base);
    for (const shade of RAMP_SHADES) put(`${name}-${shade}`, ramp[shade]);
  }

  const grey = neutralRamp(neutral.hue, neutral.saturation);
  for (const shade of RAMP_SHADES) put(`n-${shade}`, grey[shade]);
  /*
   * The endpoints stay pure. `text-white` is mostly used for a label sitting on
   * a filled accent button, where a tinted white reads as a mistake rather than
   * as warmth, and `bg-black` is used where black is meant literally.
   */
  put("n-0", "255 255 255");
  put("n-1000", "0 0 0");

  return out.join(";");
}

function geometryVars(theme: Theme): string {
  const out: string[] = [];
  const put = (name: string, value: string) => out.push(`--${name}:${value}`);

  const r = resolvedRadius(theme.radius);
  put("radius-base", `${r.base}px`);
  put("radius-card", `${r.card}px`);
  put("radius-control", `${r.control}px`);
  put("radius-input", `${r.input}px`);
  put("radius-badge", `${r.badge}px`);
  put("radius-pill", `${r.pill}px`);
  // Half sizes read better on small inner elements than the full corner does.
  put("radius-inner", `${Math.round(r.base * 0.6)}px`);

  const b = theme.border;
  put("border-width", `${b.width}px`);
  put("border-strong", `${b.strongWidth}px`);
  put("border-style", b.style);
  put("accent-bar", `${b.accentBar}px`);
  put("focus-width", `${b.focusWidth}px`);
  put("line-alpha", String(1 - b.softness / 100 / 1.6));

  const d = theme.density;
  put("density", String(d.scale));
  put("gutter", `${Math.round(d.gutter * d.scale)}px`);
  put("gutter-sm", `${Math.round(d.gutter * d.scale * 0.5)}px`);
  put("gutter-md", `${Math.round(d.gutter * d.scale * 0.75)}px`);
  put("card-padding", `${Math.round(d.cardPadding * d.scale)}px`);
  put("control-height", `${Math.round(d.controlHeight * d.scale)}px`);
  put("row-height", `${Math.round(d.rowHeight * d.scale)}px`);
  put("metric-height", `${Math.round(d.metricHeight * d.scale)}px`);
  put("sidebar-width", `${Math.round(d.sidebarWidth)}px`);
  put("content-max", d.maxWidth > 0 ? `${d.maxWidth}px` : "none");
  put("space-unit", `${(0.25 * d.scale).toFixed(4)}rem`);

  const t = theme.typography;
  put("font-heading", FONT_STACKS[t.heading]);
  put("font-body", FONT_STACKS[t.body]);
  put("font-mono", FONT_STACKS[t.mono]);
  put("type-scale", String(t.scale));
  put("heading-weight", String(Math.round(t.headingWeight)));
  put("heading-tracking", `${t.headingTracking}em`);
  put("body-leading", String(t.bodyLineHeight));
  put("label-transform", t.labelCaps ? "uppercase" : "none");
  put("label-tracking", `${t.labelTracking}em`);
  put("display-scale", String(t.displaySize));

  const m = theme.motion;
  const on = m.enabled;
  put("ease", EASING_CURVES[m.easing]);
  put("motion-scale", on ? String(m.intensity) : "0");
  put("duration-fast", on ? `${Math.round(140 / m.speed)}ms` : "0ms");
  put("duration", on ? `${Math.round(320 / m.speed)}ms` : "0ms");
  put("duration-slow", on ? `${Math.round(680 / m.speed)}ms` : "0ms");
  put("lift", on && m.hover ? `${(-3 * m.intensity).toFixed(2)}px` : "0px");
  put("reveal-distance", on ? `${Math.round(24 * m.intensity)}px` : "0px");
  put("marquee-duration", `${Math.round(34 / Math.max(0.4, m.speed))}s`);

  put("shadow", SHADOWS[Math.round(theme.effects.shadow)] ?? "none");
  put("glow", theme.effects.glow ? "0 0 0 1px rgb(var(--accent) / 0.35), 0 0 28px rgb(var(--accent) / 0.22)" : "none");

  return out.join(";");
}

/**
 * The whole theme as one stylesheet. Deterministic: the same theme always
 * produces byte-identical CSS, which is what lets the server render it and the
 * client adopt it without a hydration mismatch.
 */
export function themeToCss(input: Theme): string {
  const theme = normaliseTheme(input);
  // `html:root` rather than `:root`: one class of specificity above the
  // fallback tokens in the stylesheet, so the theme wins no matter which of the
  // two the browser happens to load first.
  const light = `html:root{${paletteVars(theme.light, theme.neutral)};${geometryVars(theme)};color-scheme:light}`;
  const dark = `html:root.dark{${paletteVars(theme.dark, theme.neutral)};color-scheme:dark}`;
  return `${light}${dark}`;
}

/**
 * Attributes stamped on <html>. Feature rules in the stylesheet key off these
 * rather than off class names, so toggling one effect never touches another.
 */
export function themeToAttributes(input: Theme): Record<string, string> {
  const t = normaliseTheme(input);
  const flag = (on: boolean) => (on ? "on" : "off");
  return {
    "data-theme-preset": t.preset,
    "data-motion": flag(t.motion.enabled),
    "data-motion-hover": flag(t.motion.enabled && t.motion.hover),
    "data-motion-underline": flag(t.motion.enabled && t.motion.underline),
    "data-motion-pulse": flag(t.motion.enabled && t.motion.pulse),
    "data-motion-transition": flag(t.motion.enabled && t.motion.pageTransition),
    "data-shadow": String(Math.round(t.effects.shadow)),
    "data-grid": flag(t.effects.gridTexture),
    "data-noise": flag(t.effects.noise),
    "data-gradients": flag(t.effects.gradients),
    "data-glass": flag(t.effects.glass),
    "data-glow": flag(t.effects.glow),
    "data-scanlines": flag(t.effects.scanlines),
    "data-vignette": flag(t.effects.vignette),
    "data-header": t.layout.header,
    "data-sidebar": t.layout.sidebar,
    "data-labels": t.typography.labelCaps ? "caps" : "plain",
  };
}

/** True when the palette pairing is legible enough to ship. */
export function paletteWarnings(p: Palette, label: string): string[] {
  const warnings: string[] = [];
  const check = (fg: string, bg: string, min: number, what: string) => {
    const [, , l1] = rgbToHsl(hexToRgb(fg));
    const [, , l2] = rgbToHsl(hexToRgb(bg));
    if (Math.abs(l1 - l2) < 1) {
      warnings.push(`${label}: ${what} is the same colour as its background`);
      return;
    }
    const ratio = contrastRatio(fg, bg);
    if (ratio < min) warnings.push(`${label}: ${what} contrast is ${ratio.toFixed(1)}:1, below ${min}:1`);
  };
  check(p.ink, p.canvas, 4.5, "body text");
  check(p.inkMuted, p.surface, 3, "muted text");
  check(p.accentInk, p.accent, 3, "text on accent");
  return warnings;
}

export { readableInk };
