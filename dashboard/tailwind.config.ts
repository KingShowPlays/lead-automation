import type { Config } from "tailwindcss";

/**
 * Colour is resolved at runtime, not at build time.
 *
 * Every family below points at CSS custom properties that the theme writes into
 * the document. That is what makes the whole interface editable: the several
 * hundred colour utilities already scattered through the components keep their
 * class names and simply resolve to whatever the current theme says, so a new
 * palette re-tints the entire dashboard without touching a component.
 *
 * The `<alpha-value>` placeholder is why those properties hold space separated
 * `R G B` triplets rather than hex: it keeps `bg-brand-600/30` working.
 */

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

/** A full ramp bound to `--<token>-<shade>` properties. */
function ramp(token: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const shade of SHADES) out[shade] = `rgb(var(--${token}-${shade}) / <alpha-value>)`;
  return out;
}

/** The neutral ramp, shared by every greyscale family name in the codebase. */
const neutral = ramp("n");

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ["var(--font-heading)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      colors: {
        white: "rgb(var(--n-0) / <alpha-value>)",
        black: "rgb(var(--n-1000) / <alpha-value>)",

        slate: neutral,
        gray: neutral,
        zinc: neutral,
        neutral,
        stone: neutral,

        brand: ramp("brand"),
        accent: ramp("accent"),

        emerald: ramp("emerald"),
        green: ramp("green"),

        cta: ramp("cta"),
        amber: ramp("amber"),
        yellow: ramp("yellow"),
        orange: ramp("orange"),

        rose: ramp("rose"),
        red: ramp("red"),

        cyan: ramp("cyan"),
        sky: ramp("sky"),
        teal: ramp("teal"),

        purple: ramp("purple"),
        violet: ramp("violet"),
        indigo: ramp("indigo"),
        fuchsia: ramp("fuchsia"),

        // Named surfaces, for markup that would rather say what a thing is than
        // pick a step off a ramp.
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-muted": "rgb(var(--surface-muted) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        "ink-muted": "rgb(var(--ink-muted) / <alpha-value>)",
      },
      borderRadius: {
        none: "0px",
        sm: "var(--radius-inner)",
        DEFAULT: "var(--radius-base)",
        md: "var(--radius-base)",
        lg: "var(--radius-card)",
        xl: "var(--radius-card)",
        "2xl": "var(--radius-card)",
        "3xl": "var(--radius-card)",
        full: "var(--radius-pill)",
      },
      transitionTimingFunction: { theme: "var(--ease)" },
      transitionDuration: { theme: "var(--duration)" },
      animation: {
        "fade-up": "fadeUp var(--duration-slow) var(--ease) both",
        "fade-in": "fadeIn var(--duration) var(--ease) both",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(var(--reveal-distance))" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
