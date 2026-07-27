/**
 * Colour maths for the theme system.
 *
 * Every colour the admin picks is stored as a single hex value. The interface,
 * though, is built out of Tailwind utilities that expect a full 50 to 950 ramp
 * (`bg-brand-600`, `text-slate-400`, `border-rose-200`, and so on). These
 * helpers expand one hex into that ramp so a single colour picker re-tints
 * hundreds of existing class names without touching a component.
 *
 * Output is always a space separated `R G B` triplet, which is the form
 * Tailwind's `<alpha-value>` syntax needs to keep `bg-brand-600/40` working.
 */

export type Rgb = [number, number, number];

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type Shade = (typeof SHADES)[number];
export const RAMP_SHADES: readonly Shade[] = SHADES;

const clamp = (n: number, lo: number, hi: number) => (n < lo ? lo : n > hi ? hi : n);

export function hexToRgb(hex: string): Rgb {
  let value = hex.trim().replace(/^#/, "");
  if (value.length === 3) value = value.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return [0, 0, 0];
  const n = parseInt(value, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: Rgb): string {
  const part = (n: number) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** Hue 0-360, saturation and lightness 0-100. */
export function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s * 100, l * 100];
}

export function hslToRgb(h: number, s: number, l: number): Rgb {
  const hn = ((h % 360) + 360) % 360 / 360;
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;
  if (sn === 0) {
    const v = Math.round(ln * 255);
    return [v, v, v];
  }
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const channel = (t: number) => {
    let tn = t;
    if (tn < 0) tn += 1;
    if (tn > 1) tn -= 1;
    if (tn < 1 / 6) return p + (q - p) * 6 * tn;
    if (tn < 1 / 2) return q;
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6;
    return p;
  };
  return [
    Math.round(channel(hn + 1 / 3) * 255),
    Math.round(channel(hn) * 255),
    Math.round(channel(hn - 1 / 3) * 255),
  ];
}

/** The `R G B` form Tailwind's alpha syntax consumes. */
export function triplet([r, g, b]: Rgb): string {
  return `${Math.round(r)} ${Math.round(g)} ${Math.round(b)}`;
}

export const hexToTriplet = (hex: string): string => triplet(hexToRgb(hex));

/**
 * Lightness offsets from the 600 stop, in percentage points, with a saturation
 * multiplier per stop. Anchoring on 600 matters: it is the shade the interface
 * uses for primary fills, so the colour the admin picked has to come out of the
 * ramp unchanged rather than approximated.
 */
const ACCENT_RAMP: Record<Shade, { dl: number; sm: number }> = {
  50: { dl: 46, sm: 0.5 },
  100: { dl: 40, sm: 0.66 },
  200: { dl: 31, sm: 0.82 },
  300: { dl: 21, sm: 0.92 },
  400: { dl: 11, sm: 0.98 },
  500: { dl: 5, sm: 1 },
  600: { dl: 0, sm: 1 },
  700: { dl: -7, sm: 1.02 },
  800: { dl: -13, sm: 1.02 },
  900: { dl: -18, sm: 1 },
  950: { dl: -27, sm: 0.94 },
};

/** Expands one hex into a 50-950 ramp whose 600 stop is exactly that hex. */
export function accentRamp(hex: string): Record<Shade, string> {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  const out = {} as Record<Shade, string>;
  for (const shade of SHADES) {
    const { dl, sm } = ACCENT_RAMP[shade];
    out[shade] = shade === 600
      ? hexToTriplet(hex)
      : triplet(hslToRgb(h, clamp(s * sm, 0, 100), clamp(l + dl, 3, 98)));
  }
  return out;
}

/**
 * Absolute lightness targets for the neutral ramp, matching the distribution
 * the interface was designed against. Neutrals cannot use the accent method:
 * they have to span near-white to near-black so that `bg-slate-950` stays a
 * page background in dark mode and `bg-slate-100` stays a subtle fill in light.
 */
const NEUTRAL_L: Record<Shade, number> = {
  50: 98.4,
  100: 96.1,
  200: 91.2,
  300: 82.9,
  400: 64.5,
  500: 46.9,
  600: 38.4,
  700: 26.5,
  800: 16.9,
  900: 11.2,
  950: 3.4,
};

/**
 * Neutral ramp from a hue and a saturation. Saturation 0 gives true greys,
 * which is what the black and white brand wants; a few points of the brand hue
 * warms the whole interface without reading as coloured.
 */
export function neutralRamp(hue: number, saturation: number): Record<Shade, string> {
  const out = {} as Record<Shade, string>;
  for (const shade of SHADES) {
    const l = NEUTRAL_L[shade];
    // Tint fades out at the extremes so white stays white and black stays black.
    const edge = 1 - Math.abs(l - 50) / 50;
    out[shade] = triplet(hslToRgb(hue, clamp(saturation, 0, 40) * (0.35 + 0.65 * edge), l));
  }
  return out;
}

/** Relative luminance, per WCAG. */
function luminance([r, g, b]: Rgb): number {
  const chan = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(hexToRgb(a));
  const lb = luminance(hexToRgb(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Picks black or white text for a background, whichever reads better on it. */
export function readableInk(background: string): string {
  return contrastRatio(background, "#ffffff") >= contrastRatio(background, "#0a0a0a") ? "#ffffff" : "#0a0a0a";
}

/** Moves a colour toward white or black by a 0-1 amount. */
export function shift(hex: string, amount: number): string {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  return rgbToHex(hslToRgb(h, s, clamp(l + amount * 100, 0, 100)));
}
