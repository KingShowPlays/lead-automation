"use client";

import { useEffect, useId, useState } from "react";
import { RiArrowDownSLine, RiArrowUpSLine, RiEyeLine, RiEyeOffLine } from "react-icons/ri";

/**
 * Editor primitives for the theme control page.
 *
 * These are deliberately plain. The page they build is the one screen where a
 * broken control is unrecoverable, because it is the screen that fixes the
 * others, so nothing here depends on a library, a portal, or a measurement.
 * Native inputs, keyboard accessible, and working at every width.
 */

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="min-w-0 py-3">
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-200">
        {label}
      </label>
      {hint && <p className="mb-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{hint}</p>}
      {children}
    </div>
  );
}

/** Range with a live readout, and a number box for exact values. */
export function Slider({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const decimals = step < 1 ? String(step).split(".")[1]?.length ?? 2 : 0;

  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <div className="flex min-w-0 items-center gap-3">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="theme-range min-w-0 flex-1"
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={Number(value.toFixed(decimals))}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
          }}
          aria-label={`${label} value`}
          className="input w-20 shrink-0 px-2 text-center tabular-nums"
        />
        {suffix && <span className="shrink-0 text-[11px] font-bold text-slate-400">{suffix}</span>}
      </div>
    </Field>
  );
}

/** On/off switch. A real checkbox underneath, so it is keyboard operable. */
export function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-w-0 cursor-pointer items-start justify-between gap-4 border-b border-slate-200 py-3 last:border-0 dark:border-slate-800">
      <span className="min-w-0">
        <span className="block text-xs font-bold text-slate-700 dark:text-slate-200">{label}</span>
        {hint && <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{hint}</span>}
      </span>
      <span className="relative shrink-0 pt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        {/*
          `rounded-full` rather than an inline radius: the theme sets corners
          with an !important universal rule, which outranks an inline style, and
          that class is the documented way to opt an element into the pill value.
        */}
        <span
          aria-hidden
          className="block h-6 w-11 rounded-full border border-slate-300 bg-slate-200 transition-colors peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600 dark:border-slate-700 dark:bg-slate-800"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute left-0.5 top-1 h-5 w-5 rounded-full bg-white transition-transform peer-checked:translate-x-5"
        />
      </span>
    </label>
  );
}

/** Segmented choice. Scrolls rather than wrapping, so it never breaks a row. */
export function Choice<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <Field label={label} hint={hint}>
      <div className="segmented-control w-full">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className="min-w-0 flex-1 whitespace-nowrap"
          >
            {option.label}
          </button>
        ))}
      </div>
    </Field>
  );
}

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Colour picker: the native swatch plus a hex box.
 *
 * The hex box keeps its own draft while it is being typed, because committing
 * every keystroke would repaint the interface from "#1", "#17", "#17a" and so
 * on. It commits only once the text is a valid colour.
 */
export function Swatch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  return (
    <div className="flex min-w-0 items-center gap-3 border-b border-slate-200 py-2.5 last:border-0 dark:border-slate-800">
      <input
        id={id}
        type="color"
        value={HEX.test(value) ? value : "#000000"}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-11 shrink-0 cursor-pointer border border-slate-300 bg-transparent p-0.5 dark:border-slate-700"
        aria-label={label}
      />
      <label htmlFor={id} className="min-w-0 flex-1 truncate text-xs font-bold text-slate-700 dark:text-slate-200">
        {label}
      </label>
      <input
        type="text"
        value={draft}
        spellCheck={false}
        onChange={(e) => {
          const next = e.target.value;
          setDraft(next);
          if (HEX.test(next.trim())) onChange(next.trim().toLowerCase());
        }}
        onBlur={() => setDraft(value)}
        aria-label={`${label} hex value`}
        className="input w-24 shrink-0 px-2 text-center font-mono text-xs uppercase"
      />
    </div>
  );
}

export interface OrderEntry {
  id: string;
  label: string;
}

/**
 * Reorderable, hideable list.
 *
 * Move buttons rather than drag and drop: they work with a keyboard, work on a
 * phone, and cannot leave an item stranded mid-drag. Drag is a nice extra on a
 * desktop, not the only way in.
 */
export function OrderList({
  items,
  order,
  hidden,
  lockedIds = [],
  onChange,
}: {
  items: readonly OrderEntry[];
  order: string[];
  hidden: string[];
  lockedIds?: string[];
  onChange: (order: string[], hidden: string[]) => void;
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  const label = (id: string) => items.find((i) => i.id === id)?.label ?? id;

  const move = (index: number, delta: number) => {
    const next = [...order];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next, hidden);
  };

  const drop = (targetId: string) => {
    if (!dragging || dragging === targetId) return;
    const next = order.filter((id) => id !== dragging);
    next.splice(next.indexOf(targetId), 0, dragging);
    onChange(next, hidden);
    setDragging(null);
  };

  const toggle = (id: string) => {
    if (lockedIds.includes(id)) return;
    onChange(order, hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id]);
  };

  return (
    <ul className="border border-slate-200 dark:border-slate-800">
      {order.map((id, index) => {
        const isHidden = hidden.includes(id);
        const locked = lockedIds.includes(id);
        return (
          <li
            key={id}
            draggable
            onDragStart={() => setDragging(id)}
            onDragEnd={() => setDragging(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => drop(id)}
            className={`flex min-w-0 items-center gap-2 border-b border-slate-200 px-3 py-2 last:border-0 dark:border-slate-800 ${
              dragging === id ? "bg-brand-500/10" : ""
            } ${isHidden ? "opacity-55" : ""}`}
          >
            <span className="w-5 shrink-0 text-center text-[11px] font-bold tabular-nums text-slate-400">{index + 1}</span>
            <span className="min-w-0 flex-1 truncate text-xs font-semibold">{label(id)}</span>

            <button
              type="button"
              onClick={() => move(index, -1)}
              disabled={index === 0}
              aria-label={`Move ${label(id)} up`}
              className="btn-ghost h-8 w-8 shrink-0 !min-h-8 !p-0"
            >
              <RiArrowUpSLine className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => move(index, 1)}
              disabled={index === order.length - 1}
              aria-label={`Move ${label(id)} down`}
              className="btn-ghost h-8 w-8 shrink-0 !min-h-8 !p-0"
            >
              <RiArrowDownSLine className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => toggle(id)}
              disabled={locked}
              aria-pressed={!isHidden}
              title={locked ? "Always visible" : isHidden ? "Show" : "Hide"}
              aria-label={`${isHidden ? "Show" : "Hide"} ${label(id)}`}
              className="btn-ghost h-8 w-8 shrink-0 !min-h-8 !p-0"
            >
              {isHidden ? <RiEyeOffLine className="h-4 w-4" /> : <RiEyeLine className="h-4 w-4" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
