"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  RiArrowGoBackLine,
  RiBrushLine,
  RiCheckLine,
  RiContrastDrop2Line,
  RiCornerUpLeftLine,
  RiFontSize,
  RiLayoutGridLine,
  RiMagicLine,
  RiPaletteLine,
  RiRefreshLine,
  RiRulerLine,
  RiSaveLine,
  RiSparkling2Line,
  RiSquareLine,
} from "react-icons/ri";
import { api } from "@/lib/api";
import { LogoMark } from "@/components/Logo";
import { Choice, Field, OrderList, Slider, Swatch, Toggle } from "@/components/site-control/controls";
import { useTheme } from "@/lib/theme/provider";
import { PRESETS, applyPreset } from "@/lib/theme/presets";
import {
  DEFAULT_THEME,
  EASING_KEYS,
  EASING_LABELS,
  FONT_KEYS,
  FONT_LABELS,
  type FontKey,
  METRIC_ITEMS,
  NAV_ITEMS,
  SECTION_ITEMS,
  paletteWarnings,
  readableInk,
  resolvedRadius,
  type Palette,
  type Theme,
} from "@/lib/theme/tokens";

/**
 * Theme control: the whole interface, editable.
 *
 * Every change here is applied to the live document the moment it is made, not
 * to a mock. That is the point of the design: what is being edited is the page
 * doing the editing, so there is no gap between the preview and the result.
 * Saving writes the same tokens to the server for everyone else.
 */

type TabId = "presets" | "colour" | "corners" | "borders" | "type" | "sizing" | "motion" | "effects" | "layout" | "brand";

const TABS: Array<{ id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "presets", label: "Presets", icon: RiMagicLine },
  { id: "colour", label: "Colour", icon: RiPaletteLine },
  { id: "corners", label: "Corners", icon: RiSquareLine },
  { id: "borders", label: "Borders", icon: RiCornerUpLeftLine },
  { id: "type", label: "Type", icon: RiFontSize },
  { id: "sizing", label: "Sizing", icon: RiRulerLine },
  { id: "motion", label: "Motion", icon: RiSparkling2Line },
  { id: "effects", label: "Effects", icon: RiContrastDrop2Line },
  { id: "layout", label: "Layout", icon: RiLayoutGridLine },
  { id: "brand", label: "Brand", icon: RiBrushLine },
];

export default function SiteControlPage() {
  const { theme, preview, save, revert, dirty, saving } = useTheme();
  const [tab, setTab] = useState<TabId>("presets");
  const [resetting, setResetting] = useState(false);

  /** Applies a change and marks the theme as no longer matching its preset. */
  const set = (patch: Partial<Theme>, keepPreset = false) =>
    preview({ ...theme, ...patch, preset: keepPreset ? theme.preset : "custom" });

  const setPalette = (mode: "light" | "dark", patch: Partial<Palette>) =>
    set({ [mode]: { ...theme[mode], ...patch } } as Partial<Theme>);

  async function onSave() {
    try {
      await save(theme);
      toast.success("Appearance saved. Everyone sees it on their next load.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the appearance");
    }
  }

  async function onReset() {
    setResetting(true);
    try {
      await api.resetTheme();
      await save(DEFAULT_THEME);
      toast.success("Back to the shipped appearance.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reset the appearance");
    } finally {
      setResetting(false);
    }
  }

  const warnings = useMemo(
    () => [...paletteWarnings(theme.light, "Light"), ...paletteWarnings(theme.dark, "Dark")],
    [theme.light, theme.dark],
  );

  return (
    <div className="page-shell">
      <header className="page-header">
        <div className="min-w-0">
          <p className="page-kicker">Theme control</p>
          <h1 className="page-title">Site control</h1>
          <p className="page-subtitle">
            Colour, corners, borders, type, spacing, motion and ordering for the whole dashboard. Changes apply to this page as
            you make them; saving publishes them.
          </p>
        </div>
        <div className="page-actions">
          <button type="button" onClick={revert} disabled={!dirty} className="btn-ghost">
            <RiArrowGoBackLine className="h-4 w-4" /> Revert
          </button>
          <button type="button" onClick={onReset} disabled={resetting || saving} className="btn-ghost">
            {resetting ? <span className="loader-spinner h-4 w-4 border-2 border-slate-400/40 border-t-slate-600" /> : <RiRefreshLine className="h-4 w-4" />}
            Reset to default
          </button>
          <button type="button" onClick={onSave} disabled={!dirty || saving} className="btn-primary">
            {saving ? <span className="loader-spinner h-4 w-4 border-2 border-white/40 border-t-white" /> : <RiSaveLine className="h-4 w-4" />}
            {dirty ? "Save appearance" : "Saved"}
          </button>
        </div>
      </header>

      {warnings.length > 0 && (
        <div className="panel accent-cta mt-6 border-t-4" role="status">
          <p className="text-xs font-bold uppercase tracking-wider text-cta-600">Legibility check</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-12">
        <nav aria-label="Theme sections" className="control-tabs xl:col-span-2">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={tab === id ? "true" : undefined}
              className={`control-tab ${tab === id ? "control-tab-active" : ""}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </nav>

        <div className="min-w-0 xl:col-span-6">
          {tab === "presets" && <Presets theme={theme} onPick={(id) => preview(applyPreset(theme, id))} />}

          {tab === "colour" && (
            <div className="panel">
              <SectionHead title="Colour" description="Two palettes, one for each mode. Every shade in the interface is derived from these." />
              <Choice
                label="Mode"
                hint="System follows the operating system and switches with it."
                value={theme.mode}
                options={[
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                  { value: "system", label: "System" },
                ]}
                onChange={(mode) => set({ mode }, true)}
              />
              <PaletteEditor label="Light palette" palette={theme.light} onChange={(patch) => setPalette("light", patch)} />
              <PaletteEditor label="Dark palette" palette={theme.dark} onChange={(patch) => setPalette("dark", patch)} />

              <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
                <SectionHead title="Greys" description="The neutral ramp behind every surface, rule and secondary label." />
                <Slider
                  label="Neutral hue"
                  hint="Which direction the greys lean. Only visible once they carry some saturation."
                  value={theme.neutral.hue}
                  min={0}
                  max={360}
                  suffix="deg"
                  onChange={(hue) => set({ neutral: { ...theme.neutral, hue } })}
                />
                <Slider
                  label="Neutral saturation"
                  hint="Zero gives true greys, which is what the black and white brand asks for."
                  value={theme.neutral.saturation}
                  min={0}
                  max={40}
                  onChange={(saturation) => set({ neutral: { ...theme.neutral, saturation } })}
                />
              </div>
            </div>
          )}

          {tab === "corners" && <Corners theme={theme} set={set} />}

          {tab === "borders" && (
            <div className="panel">
              <SectionHead title="Borders" description="The rules that separate everything. This interface leans on them instead of shadow." />
              <Slider label="Hairline width" value={theme.border.width} min={0} max={4} step={0.5} suffix="px"
                onChange={(width) => set({ border: { ...theme.border, width } })} />
              <Slider label="Strong rule width" value={theme.border.strongWidth} min={0} max={8} step={0.5} suffix="px"
                onChange={(strongWidth) => set({ border: { ...theme.border, strongWidth } })} />
              <Slider label="Accent bar" hint="The coloured edge on metric cards, panels and queue cards."
                value={theme.border.accentBar} min={0} max={10} suffix="px"
                onChange={(accentBar) => set({ border: { ...theme.border, accentBar } })} />
              <Slider label="Focus ring" hint="Thickness of the keyboard focus outline. Below two pixels it gets hard to see."
                value={theme.border.focusWidth} min={1} max={6} suffix="px"
                onChange={(focusWidth) => set({ border: { ...theme.border, focusWidth } })} />
              <Slider label="Softness" hint="Fades rules toward their background. Zero keeps them at full strength."
                value={theme.border.softness} min={0} max={100} suffix="%"
                onChange={(softness) => set({ border: { ...theme.border, softness } })} />
              <Choice label="Style" value={theme.border.style}
                options={[
                  { value: "solid", label: "Solid" },
                  { value: "dashed", label: "Dashed" },
                  { value: "dotted", label: "Dotted" },
                ]}
                onChange={(style) => set({ border: { ...theme.border, style } })} />
            </div>
          )}

          {tab === "type" && (
            <div className="panel">
              <SectionHead title="Type" description="All four families are loaded up front, so switching one never causes a reflow." />
              <FontChoice label="Headings" value={theme.typography.heading}
                onChange={(heading) => set({ typography: { ...theme.typography, heading } })} />
              <FontChoice label="Body" value={theme.typography.body}
                onChange={(body) => set({ typography: { ...theme.typography, body } })} />
              <FontChoice label="Monospace" value={theme.typography.mono}
                onChange={(mono) => set({ typography: { ...theme.typography, mono } })} />
              <Slider label="Overall size" hint="Scales the root font size, and with it every spacing step in the interface."
                value={theme.typography.scale} min={0.85} max={1.25} step={0.01} suffix="x"
                onChange={(scale) => set({ typography: { ...theme.typography, scale } })} />
              <Slider label="Display size" hint="Page titles and metric figures only."
                value={theme.typography.displaySize} min={0.8} max={1.6} step={0.01} suffix="x"
                onChange={(displaySize) => set({ typography: { ...theme.typography, displaySize } })} />
              <Slider label="Heading weight" value={theme.typography.headingWeight} min={400} max={900} step={50}
                onChange={(headingWeight) => set({ typography: { ...theme.typography, headingWeight } })} />
              <Slider label="Heading tracking" value={theme.typography.headingTracking} min={-0.08} max={0.08} step={0.005} suffix="em"
                onChange={(headingTracking) => set({ typography: { ...theme.typography, headingTracking } })} />
              <Slider label="Body line height" value={theme.typography.bodyLineHeight} min={1.2} max={2} step={0.05}
                onChange={(bodyLineHeight) => set({ typography: { ...theme.typography, bodyLineHeight } })} />
              <Slider label="Label tracking" value={theme.typography.labelTracking} min={0} max={0.3} step={0.01} suffix="em"
                onChange={(labelTracking) => set({ typography: { ...theme.typography, labelTracking } })} />
              <Toggle label="Capitalised labels" hint="Small labels in capitals, as they ship, or in sentence case."
                checked={theme.typography.labelCaps}
                onChange={(labelCaps) => set({ typography: { ...theme.typography, labelCaps } })} />
            </div>
          )}

          {tab === "sizing" && (
            <div className="panel">
              <SectionHead title="Sizing" description="How much room the interface takes. Every value is scaled by the density multiplier." />
              <Slider label="Density" hint="One multiplier over gutters, padding and control heights."
                value={theme.density.scale} min={0.8} max={1.35} step={0.01} suffix="x"
                onChange={(scale) => set({ density: { ...theme.density, scale } })} />
              <Slider label="Page gutter" value={theme.density.gutter} min={8} max={72} suffix="px"
                onChange={(gutter) => set({ density: { ...theme.density, gutter } })} />
              <Slider label="Card padding" value={theme.density.cardPadding} min={8} max={56} suffix="px"
                onChange={(cardPadding) => set({ density: { ...theme.density, cardPadding } })} />
              <Slider label="Control height" hint="Buttons, inputs and badges. Forty four pixels is the comfortable touch target."
                value={theme.density.controlHeight} min={32} max={64} suffix="px"
                onChange={(controlHeight) => set({ density: { ...theme.density, controlHeight } })} />
              <Slider label="Table row height" value={theme.density.rowHeight} min={32} max={84} suffix="px"
                onChange={(rowHeight) => set({ density: { ...theme.density, rowHeight } })} />
              <Slider label="Metric card height" value={theme.density.metricHeight} min={96} max={260} suffix="px"
                onChange={(metricHeight) => set({ density: { ...theme.density, metricHeight } })} />
              <Slider label="Sidebar width" value={theme.density.sidebarWidth} min={180} max={380} suffix="px"
                onChange={(sidebarWidth) => set({ density: { ...theme.density, sidebarWidth } })} />
              <Slider label="Content width" hint="Zero runs the full width of the screen. Anything else centres the page at that width."
                value={theme.density.maxWidth} min={0} max={2200} step={20} suffix="px"
                onChange={(maxWidth) => set({ density: { ...theme.density, maxWidth } })} />
            </div>
          )}

          {tab === "motion" && (
            <div className="panel">
              <SectionHead title="Motion" description="Anyone whose system asks for reduced motion gets none of this, whatever is set here." />
              <Toggle label="Motion" hint="The master switch. Off means a still interface, not a slow one."
                checked={theme.motion.enabled} onChange={(enabled) => set({ motion: { ...theme.motion, enabled } })} />
              <Slider label="Intensity" hint="How far things travel."
                value={theme.motion.intensity} min={0} max={2} step={0.05} suffix="x"
                onChange={(intensity) => set({ motion: { ...theme.motion, intensity } })} />
              <Slider label="Speed" hint="Above one is quicker, below one is slower and more deliberate."
                value={theme.motion.speed} min={0.4} max={2.5} step={0.05} suffix="x"
                onChange={(speed) => set({ motion: { ...theme.motion, speed } })} />
              <Field label="Easing" hint="The curve everything follows.">
                <select className="input" value={theme.motion.easing}
                  onChange={(e) => set({ motion: { ...theme.motion, easing: e.target.value as Theme["motion"]["easing"] } })}>
                  {EASING_KEYS.map((key) => (
                    <option key={key} value={key}>{EASING_LABELS[key]}</option>
                  ))}
                </select>
              </Field>

              <div className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-800">
                <Toggle label="Reveal on scroll" hint="Sections fade up as they come into view." checked={theme.motion.reveal}
                  onChange={(reveal) => set({ motion: { ...theme.motion, reveal } })} />
                <Toggle label="Stagger" hint="Grouped items arrive one after another rather than together." checked={theme.motion.stagger}
                  onChange={(stagger) => set({ motion: { ...theme.motion, stagger } })} />
                <Toggle label="Hover lift" hint="Cards and buttons rise slightly under the pointer." checked={theme.motion.hover}
                  onChange={(hover) => set({ motion: { ...theme.motion, hover } })} />
                <Toggle label="Link underline wipe" checked={theme.motion.underline}
                  onChange={(underline) => set({ motion: { ...theme.motion, underline } })} />
                <Toggle label="Page transitions" hint="A short fade between routes." checked={theme.motion.pageTransition}
                  onChange={(pageTransition) => set({ motion: { ...theme.motion, pageTransition } })} />
                <Toggle label="Counting figures" hint="Metric values count up to their number." checked={theme.motion.counters}
                  onChange={(counters) => set({ motion: { ...theme.motion, counters } })} />
                <Toggle label="Magnetic buttons" hint="Primary actions lean toward the pointer. Desktop only." checked={theme.motion.magnetic}
                  onChange={(magnetic) => set({ motion: { ...theme.motion, magnetic } })} />
                <Toggle label="Marquee" hint="Long strips of small items scroll instead of wrapping." checked={theme.motion.marquee}
                  onChange={(marquee) => set({ motion: { ...theme.motion, marquee } })} />
                <Toggle label="Custom cursor" hint="A follower that grows over anything interactive. Fine pointers only." checked={theme.motion.cursor}
                  onChange={(cursor) => set({ motion: { ...theme.motion, cursor } })} />
                <Toggle label="Momentum scrolling" hint="Weighted scrolling on desktop. Touch keeps the platform's own." checked={theme.motion.smoothScroll}
                  onChange={(smoothScroll) => set({ motion: { ...theme.motion, smoothScroll } })} />
                <Toggle label="Parallax" hint="Selected blocks drift slightly against the scroll." checked={theme.motion.parallax}
                  onChange={(parallax) => set({ motion: { ...theme.motion, parallax } })} />
                <Toggle label="Loading pulse" checked={theme.motion.pulse}
                  onChange={(pulse) => set({ motion: { ...theme.motion, pulse } })} />
              </div>
            </div>
          )}

          {tab === "effects" && (
            <div className="panel">
              <SectionHead title="Effects" description="Texture and depth. Used sparingly they add character; all at once they add noise." />
              <Slider label="Elevation" hint="Zero is the flat system this interface ships with."
                value={theme.effects.shadow} min={0} max={3} suffix="lvl"
                onChange={(shadow) => set({ effects: { ...theme.effects, shadow } })} />
              <Toggle label="Grid texture" hint="A structural grid behind the page." checked={theme.effects.gridTexture}
                onChange={(gridTexture) => set({ effects: { ...theme.effects, gridTexture } })} />
              <Toggle label="Film grain" checked={theme.effects.noise}
                onChange={(noise) => set({ effects: { ...theme.effects, noise } })} />
              <Toggle label="Scanlines" checked={theme.effects.scanlines}
                onChange={(scanlines) => set({ effects: { ...theme.effects, scanlines } })} />
              <Toggle label="Vignette" checked={theme.effects.vignette}
                onChange={(vignette) => set({ effects: { ...theme.effects, vignette } })} />
              <Toggle label="Frosted panels" hint="Translucent surfaces with a blur behind them." checked={theme.effects.glass}
                onChange={(glass) => set({ effects: { ...theme.effects, glass } })} />
              <Toggle label="Accent glow" hint="A halo on primary actions." checked={theme.effects.glow}
                onChange={(glow) => set({ effects: { ...theme.effects, glow } })} />
              <Toggle label="Gradients" hint="Off flattens every gradient to the colour it stood for." checked={theme.effects.gradients}
                onChange={(gradients) => set({ effects: { ...theme.effects, gradients } })} />
            </div>
          )}

          {tab === "layout" && (
            <div className="panel">
              <SectionHead title="Layout and order" description="What appears, and in what order. Drag a row, or use the arrows." />

              <Choice label="Sidebar side" value={theme.layout.sidebar}
                options={[{ value: "left", label: "Left" }, { value: "right", label: "Right" }]}
                onChange={(sidebar) => set({ layout: { ...theme.layout, sidebar } })} />
              <Choice label="Page header" hint="Sticky keeps the title and actions in view while scrolling."
                value={theme.layout.header}
                options={[{ value: "static", label: "Static" }, { value: "sticky", label: "Sticky" }]}
                onChange={(header) => set({ layout: { ...theme.layout, header } })} />

              <Field label="Navigation" hint="Theme control cannot be hidden: it is the only way back from a hidden one.">
                <OrderList items={NAV_ITEMS} order={theme.layout.navOrder} hidden={theme.layout.navHidden}
                  lockedIds={["site-control"]}
                  onChange={(navOrder, navHidden) => set({ layout: { ...theme.layout, navOrder, navHidden } })} />
              </Field>

              <Field label="Overview sections">
                <OrderList items={SECTION_ITEMS} order={theme.layout.sectionOrder} hidden={theme.layout.sectionHidden}
                  onChange={(sectionOrder, sectionHidden) => set({ layout: { ...theme.layout, sectionOrder, sectionHidden } })} />
              </Field>

              <Field label="Headline metrics">
                <OrderList items={METRIC_ITEMS} order={theme.layout.metricOrder} hidden={theme.layout.metricHidden}
                  onChange={(metricOrder, metricHidden) => set({ layout: { ...theme.layout, metricOrder, metricHidden } })} />
              </Field>
            </div>
          )}

          {tab === "brand" && (
            <div className="panel">
              <SectionHead title="Brand" description="The mark and the words around it." />
              <div className="mb-4 flex items-center gap-4 border border-slate-200 p-4 dark:border-slate-800">
                <LogoMark className="h-16 w-16 shrink-0 text-ink" framed={theme.brand.logo === "framed"} title="Brand mark" />
                <div className="min-w-0">
                  <p className="font-heading text-lg font-bold">
                    {theme.brand.wordmark}
                    <span className="text-brand-600">{theme.brand.wordmarkAccent}</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{theme.brand.tagline}</p>
                </div>
              </div>

              <Choice label="Mark" value={theme.brand.logo}
                options={[
                  { value: "framed", label: "Framed" },
                  { value: "mark", label: "Unframed" },
                  { value: "none", label: "Hidden" },
                ]}
                onChange={(logo) => set({ brand: { ...theme.brand, logo } })} />

              <Field label="Product name" hint="Shown in the sidebar footer.">
                <input className="input" value={theme.brand.productName} maxLength={40}
                  onChange={(e) => set({ brand: { ...theme.brand, productName: e.target.value } })} />
              </Field>
              <Field label="Wordmark">
                <input className="input" value={theme.brand.wordmark} maxLength={20}
                  onChange={(e) => set({ brand: { ...theme.brand, wordmark: e.target.value } })} />
              </Field>
              <Field label="Wordmark accent" hint="The part rendered in the accent colour.">
                <input className="input" value={theme.brand.wordmarkAccent} maxLength={20}
                  onChange={(e) => set({ brand: { ...theme.brand, wordmarkAccent: e.target.value } })} />
              </Field>
              <Field label="Tagline">
                <input className="input" value={theme.brand.tagline} maxLength={80}
                  onChange={(e) => set({ brand: { ...theme.brand, tagline: e.target.value } })} />
              </Field>
              <Toggle label="Show wordmark" checked={theme.brand.showWordmark}
                onChange={(showWordmark) => set({ brand: { ...theme.brand, showWordmark } })} />
            </div>
          )}
        </div>

        <div className="min-w-0 xl:col-span-4">
          <Preview />
        </div>
      </div>
    </div>
  );
}

function SectionHead({ title, description }: { title: string; description: string }) {
  return (
    <div className="section-heading">
      <div className="min-w-0">
        <h2 className="section-title">{title}</h2>
        <p className="section-description">{description}</p>
      </div>
    </div>
  );
}

function FontChoice({
  label,
  value,
  onChange,
}: {
  label: string;
  value: FontKey;
  onChange: (value: FontKey) => void;
}) {
  return (
    <Field label={label}>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value as FontKey)}>
        {FONT_KEYS.map((key) => (
          <option key={key} value={key}>
            {FONT_LABELS[key]}
          </option>
        ))}
      </select>
    </Field>
  );
}

function PaletteEditor({
  label,
  palette,
  onChange,
}: {
  label: string;
  palette: Palette;
  onChange: (patch: Partial<Palette>) => void;
}) {
  const rows: Array<[keyof Palette, string]> = [
    ["canvas", "Page background"],
    ["surface", "Card surface"],
    ["surfaceMuted", "Muted fill"],
    ["line", "Rules"],
    ["ink", "Text"],
    ["inkMuted", "Secondary text"],
    ["accent", "Accent"],
    ["accentInk", "Text on accent"],
    ["positive", "Positive"],
    ["warning", "Warning"],
    ["danger", "Danger"],
    ["info", "Information"],
    ["highlight", "Highlight"],
  ];

  return (
    <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">{label}</h3>
        <button
          type="button"
          className="text-[11px] font-bold text-brand-600 hover:underline"
          onClick={() => onChange({ accentInk: readableInk(palette.accent) })}
        >
          Fix accent text
        </button>
      </div>
      {rows.map(([key, rowLabel]) => (
        <Swatch key={key} label={rowLabel} value={palette[key]} onChange={(value) => onChange({ [key]: value } as Partial<Palette>)} />
      ))}
    </div>
  );
}

/**
 * Corner control. The master value drives every corner while they are linked;
 * unlinking exposes each surface separately, which is what "perfect" means here.
 */
function Corners({ theme, set }: { theme: Theme; set: (patch: Partial<Theme>, keepPreset?: boolean) => void }) {
  const r = theme.radius;
  const shown = resolvedRadius(r);
  const update = (patch: Partial<Theme["radius"]>) => set({ radius: { ...r, ...patch } });

  const SHAPES: Array<[string, number]> = [
    ["Cards", shown.card],
    ["Buttons", shown.control],
    ["Inputs", shown.input],
    ["Badges", shown.badge],
    ["Pills", shown.pill],
  ];

  return (
    <div className="panel">
      <SectionHead
        title="Corners"
        description="One master radius, or each surface set on its own. Pills keep their own value either way, so avatars and spinners stay round."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {SHAPES.map(([name, value]) => (
          <div key={name} className="min-w-0 text-center">
            {/*
              The radius travels as a custom property rather than as an inline
              border-radius: the theme's universal rule is !important and would
              otherwise flatten these samples to the current corner, leaving the
              control showing every shape as identical.
            */}
            <div
              className="corner-sample mx-auto flex h-14 w-full items-center justify-center border-2 border-brand-600 bg-brand-500/10"
              style={{ "--sample-radius": `${Math.min(value, 28)}px` } as React.CSSProperties}
              aria-hidden
            />
            <p className="mt-1.5 truncate text-[11px] font-bold">{name}</p>
            <p className="text-[10px] tabular-nums text-slate-400">{Math.round(value)}px</p>
          </div>
        ))}
      </div>

      <Toggle
        label="Link every corner"
        hint="On, one slider sets the whole interface. Off, each surface is set separately."
        checked={r.linked}
        onChange={(linked) => update({ linked })}
      />

      <Slider label={r.linked ? "Corner radius" : "Base radius"} value={r.base} min={0} max={48} suffix="px"
        onChange={(base) => update({ base })} />

      {!r.linked && (
        <>
          <Slider label="Cards and panels" value={r.card} min={0} max={48} suffix="px" onChange={(card) => update({ card })} />
          <Slider label="Buttons" value={r.control} min={0} max={48} suffix="px" onChange={(control) => update({ control })} />
          <Slider label="Inputs" value={r.input} min={0} max={48} suffix="px" onChange={(input) => update({ input })} />
          <Slider label="Badges" value={r.badge} min={0} max={48} suffix="px" onChange={(badge) => update({ badge })} />
        </>
      )}

      <Slider label="Pills" hint="Avatars, dots and anything meant to be fully round."
        value={r.pill} min={0} max={999} suffix="px" onChange={(pill) => update({ pill })} />

      <div className="mt-3 flex flex-wrap gap-2">
        {[
          ["Square", 0],
          ["Barely", 2],
          ["Soft", 6],
          ["Rounded", 12],
          ["Very round", 20],
        ].map(([name, value]) => (
          <button key={name as string} type="button" className="btn-ghost !min-h-9 px-3 text-xs"
            onClick={() => update({ linked: true, base: value as number })}>
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

function Presets({ theme, onPick }: { theme: Theme; onPick: (id: string) => void }) {
  return (
    <div className="panel">
      <SectionHead
        title="Presets"
        description="A complete look in one click. Your navigation order and product naming are kept; everything visual is replaced."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {PRESETS.map((preset) => {
          const active = theme.preset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onPick(preset.id)}
              aria-pressed={active}
              className={`control-card min-w-0 border p-4 text-left transition-colors ${
                active ? "border-brand-600 bg-brand-500/10" : "border-slate-200 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-900"
              }`}
            >
              <span className="flex items-center gap-2">
                {preset.swatch.map((colour, index) => (
                  <span key={index} className="h-5 w-5 shrink-0 border border-slate-300 dark:border-slate-700" style={{ background: colour }} aria-hidden />
                ))}
                <span className="min-w-0 flex-1 truncate font-heading text-sm font-extrabold">{preset.name}</span>
                {active && <RiCheckLine className="h-4 w-4 shrink-0 text-brand-600" />}
              </span>
              <span className="mt-2 block text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{preset.description}</span>
            </button>
          );
        })}
      </div>
      {theme.preset === "custom" && (
        <p className="mt-4 text-[11px] text-slate-500">
          The current appearance has been edited away from every preset. Picking one replaces those edits.
        </p>
      )}
    </div>
  );
}

/** A compact sample of the interface, so the effect of a change is visible without scrolling. */
function Preview() {
  return (
    <div className="panel xl:sticky xl:top-4">
      <SectionHead title="Preview" description="The same components the rest of the dashboard is built from." />

      <div className="metric-card accent-brand">
        <span className="metric-icon text-brand-600">
          <RiPaletteLine />
        </span>
        <p className="metric-value">
          <span className="currency-mark">₦</span>1,240,000
        </p>
        <p className="metric-label">Revenue won</p>
        <p className="metric-context">₦155,000 average deal</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn-primary">Primary</button>
        <button type="button" className="btn-ghost">Secondary</button>
        <button type="button" className="btn-danger">Danger</button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="status-badge text-emerald-600">Qualified</span>
        <span className="status-badge text-cta-600">Pending</span>
        <span className="status-badge text-rose-600">Rejected</span>
      </div>

      <div className="mt-4">
        <label className="label" htmlFor="preview-input">Sample field</label>
        <input id="preview-input" className="input" defaultValue="Crystal Scents" />
      </div>

      <div className="table-shell !mt-4">
        <table className="data-table">
          <thead>
            <tr>
              <th>Business</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Crystal Scents</td>
              <td className="tabular-nums">82</td>
            </tr>
            <tr>
              <td>Amara Kitchen</td>
              <td className="tabular-nums">74</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
