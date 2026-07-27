"use client";

import {
  AnimatePresence,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type Variants,
} from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { EASING_CURVES, type MotionTokens } from "./tokens";
import { useTheme } from "./provider";

/**
 * Motion primitives, all of them answerable to the theme.
 *
 * Two principles run through this file.
 *
 * The first is that motion is opt-out at three levels: the operating system's
 * reduced-motion setting, the theme's master switch, and a per-effect toggle.
 * Any one of them saying no means the component renders as a plain element
 * rather than an animated one that happens to be sitting still, so there is no
 * animation machinery left running for someone who asked for none.
 *
 * The second is that an entrance animation must never be able to hide content.
 * Scroll-triggered reveals fail in ways that are easy to miss: an element inside
 * a scroll container the observer cannot see, a viewport that never fires,
 * content restored from the back/forward cache. Every reveal here therefore
 * carries a deadline, and shows itself when the deadline passes whatever the
 * observer thinks. Late is recoverable; invisible is not.
 */

const EASE_ARRAY: Record<string, [number, number, number, number]> = {
  expo: [0.16, 1, 0.3, 1],
  quint: [0.83, 0, 0.17, 1],
  standard: [0.4, 0, 0.2, 1],
  spring: [0.34, 1.56, 0.64, 1],
  linear: [0, 0, 1, 1],
};

/** The theme's motion settings, with the OS preference folded in. */
export function useMotion(): MotionTokens & { ease: [number, number, number, number]; ok: boolean } {
  const { theme } = useTheme();
  const reduced = useReducedMotion();
  const enabled = theme.motion.enabled && !reduced;
  return {
    ...theme.motion,
    enabled,
    ok: enabled,
    ease: EASE_ARRAY[theme.motion.easing] ?? EASE_ARRAY.expo,
  };
}

/**
 * True once the element has been seen, or once the deadline has passed. The
 * deadline is what makes a reveal safe to put anywhere.
 */
function useSeen(ref: React.RefObject<Element | null>, deadlineMs = 1400): boolean {
  const inView = useInView(ref, { once: true, margin: "0px 0px -48px 0px", amount: 0.01 });
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setExpired(true), deadlineMs);
    return () => window.clearTimeout(id);
  }, [deadlineMs]);

  return inView || expired;
}

type Direction = "up" | "down" | "left" | "right" | "none";

const OFFSETS: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: 1 },
  down: { x: 0, y: -1 },
  left: { x: 1, y: 0 },
  right: { x: -1, y: 0 },
  none: { x: 0, y: 0 },
};

/** Fades and slides its children in as they come into view. */
export function Reveal({
  children,
  className,
  delay = 0,
  direction = "up",
  scale = false,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: Direction;
  scale?: boolean;
}) {
  const m = useMotion();
  const ref = useRef<HTMLDivElement>(null);
  const seen = useSeen(ref);

  if (!m.ok || !m.reveal) return <div className={className}>{children}</div>;

  const offset = OFFSETS[direction];
  const distance = 26 * m.intensity;

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, x: offset.x * distance, y: offset.y * distance, scale: scale ? 0.97 : 1 }}
      animate={seen ? { opacity: 1, x: 0, y: 0, scale: 1 } : undefined}
      transition={{ duration: 0.62 / m.speed, delay: delay / m.speed, ease: m.ease }}
    >
      {children}
    </motion.div>
  );
}

const groupVariants: Variants = {
  hidden: {},
  visible: (stagger: number) => ({ transition: { staggerChildren: stagger, delayChildren: 0.04 } }),
};

/** Cascades its StaggerItem children into view one after another. */
export function Stagger({
  children,
  className,
  step = 0.07,
}: {
  children: ReactNode;
  className?: string;
  step?: number;
}) {
  const m = useMotion();
  const ref = useRef<HTMLDivElement>(null);
  const seen = useSeen(ref);

  if (!m.ok || !m.stagger) return <div className={className}>{children}</div>;

  return (
    <motion.div
      ref={ref}
      className={className}
      custom={step / m.speed}
      variants={groupVariants}
      initial="hidden"
      animate={seen ? "visible" : "hidden"}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const m = useMotion();
  if (!m.ok || !m.stagger) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 22 * m.intensity },
        visible: { opacity: 1, y: 0, transition: { duration: 0.58 / m.speed, ease: m.ease } },
      }}
    >
      {children}
    </motion.div>
  );
}

/** Headline treatment: each word wipes up from behind its own mask. */
export function WordReveal({ text, className, delay = 0 }: { text: string; className?: string; delay?: number }) {
  const m = useMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useSeen(ref);

  if (!m.ok || !m.reveal) return <span className={className}>{text}</span>;

  const words = text.split(" ");
  return (
    <motion.span
      ref={ref}
      className={className}
      initial="hidden"
      animate={seen ? "visible" : "hidden"}
      transition={{ staggerChildren: 0.05 / m.speed, delayChildren: delay }}
      aria-label={text}
    >
      {words.map((word, index) => (
        <span key={`${word}-${index}`} className="inline-block overflow-hidden align-bottom" aria-hidden>
          <motion.span
            className="inline-block"
            variants={{
              hidden: { y: "110%", opacity: 0 },
              visible: { y: "0%", opacity: 1, transition: { duration: 0.72 / m.speed, ease: m.ease } },
            }}
          >
            {word}
            {index < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </motion.span>
  );
}

/** Pulls its child toward the cursor. Fine pointers only. */
export function Magnetic({
  children,
  strength = 0.3,
  className,
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const m = useMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 260, damping: 18, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 260, damping: 18, mass: 0.4 });

  if (!m.ok || !m.magnetic) return <div className={className}>{children}</div>;

  const onMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const node = ref.current;
    if (!node || window.matchMedia("(pointer: coarse)").matches) return;
    const rect = node.getBoundingClientRect();
    x.set((event.clientX - (rect.left + rect.width / 2)) * strength * m.intensity);
    y.set((event.clientY - (rect.top + rect.height / 2)) * strength * m.intensity);
  };

  const reset = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ x: sx, y: sy }}
      onMouseMove={onMove}
      onMouseLeave={reset}
    >
      {children}
    </motion.div>
  );
}

/**
 * Counts up to a value by writing to the DOM node directly, so the number
 * animates without re-rendering React sixty times a second. Falls back to the
 * final value immediately when counters are off.
 */
export function Counter({
  value,
  format = (n) => Math.round(n).toLocaleString(),
  prefix,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  /**
   * Rendered in its own element ahead of the figure. Currency symbols belong
   * here rather than inside the formatted string: the display face has no naira
   * glyph, so it falls back to one whose ink is wider than its advance, and at
   * heading sizes with negative tracking it collides with the first digit.
   */
  prefix?: string;
  className?: string;
}) {
  const m = useMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (!m.ok || !m.counters) {
      node.textContent = format(value);
      from.current = value;
      return;
    }

    const start = from.current;
    const delta = value - start;
    if (delta === 0) {
      node.textContent = format(value);
      return;
    }

    const duration = 800 / m.speed;
    const began = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - began) / duration);
      // Ease out cubic: fast at first, settles precisely on the value.
      const eased = 1 - (1 - t) ** 3;
      node.textContent = format(start + delta * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
    // format is treated as stable for the lifetime of the node.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, m.ok, m.counters, m.speed]);

  // Rendered with the final value so the server output and a no-JS load are
  // both correct, and so the number never starts as an empty box.
  return (
    <span className={className}>
      {prefix && <span className="currency-mark">{prefix}</span>}
      <span ref={ref}>{format(value)}</span>
    </span>
  );
}

/** Horizontal ticker. Duplicated content makes the loop seamless. */
export function Marquee({ children, className }: { children: ReactNode; className?: string }) {
  const m = useMotion();
  if (!m.ok || !m.marquee) {
    return <div className={`overflow-x-auto ${className ?? ""}`}>{children}</div>;
  }
  return (
    <div className={`marquee mask-fade-x ${className ?? ""}`} aria-hidden={false}>
      <div className="marquee-track">
        <div className="marquee-part">{children}</div>
        <div className="marquee-part" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Cursor follower that grows over interactive targets. */
export function Cursor() {
  const m = useMotion();
  const [ready, setReady] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [visible, setVisible] = useState(false);
  const [label, setLabel] = useState<string | null>(null);
  const [active, setActive] = useState(false);

  const x = useMotionValue(-200);
  const y = useMotionValue(-200);
  const sx = useSpring(x, { stiffness: 420, damping: 32, mass: 0.35 });
  const sy = useSpring(y, { stiffness: 420, damping: 32, mass: 0.35 });

  const on = m.ok && m.cursor;

  useEffect(() => {
    setReady(on && window.matchMedia("(pointer: fine)").matches);
  }, [on]);

  useEffect(() => {
    if (!ready) return;

    const onMove = (event: MouseEvent) => {
      x.set(event.clientX);
      y.set(event.clientY);
      setEngaged(true);
      setVisible(true);
      const target = event.target as HTMLElement | null;
      const labelled = target?.closest<HTMLElement>("[data-cursor]");
      setLabel(labelled?.dataset.cursor ?? null);
      setActive(Boolean(target?.closest("a, button, [role='button'], input, textarea, select")) || Boolean(labelled));
    };
    const onLeave = () => setVisible(false);

    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, [ready, x, y]);

  // The native cursor is left alone: hiding it and drawing a replacement is
  // what makes custom cursors feel broken when a frame is dropped.
  //
  // Nothing is rendered until the pointer has actually moved. A follower parked
  // off-screen waiting for its first event is a real element sitting outside the
  // viewport, which is exactly what the layout audit is built to catch, and it
  // has no business existing before there is a cursor to follow.
  if (!ready || !engaged) return null;

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[100] hidden md:block"
      style={{ x: sx, y: sy }}
    >
      <motion.div
        className="relative -translate-x-1/2 -translate-y-1/2"
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <motion.div
          className="grid place-items-center rounded-full border border-brand-600 bg-brand-500/15"
          animate={{ width: label ? 84 : active ? 40 : 16, height: label ? 84 : active ? 40 : 16 }}
          transition={{ type: "spring", stiffness: 320, damping: 26 }}
        >
          <AnimatePresence>
            {label && (
              <motion.span
                key={label}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.18 }}
                className="font-mono text-[10px] uppercase tracking-[0.16em]"
              >
                {label}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

/**
 * Momentum scrolling. Skipped on touch, where the platform's own scrolling is
 * better than anything script can do and fighting it causes the exact
 * stuttering this is supposed to avoid.
 */
export function SmoothScroll() {
  const m = useMotion();
  const on = m.ok && m.smoothScroll;

  useEffect(() => {
    if (!on) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    let cancelled = false;
    let destroy: (() => void) | null = null;

    void import("lenis").then(({ default: Lenis }) => {
      if (cancelled) return;
      const lenis = new Lenis({
        duration: 1.05 / m.speed,
        easing: (t: number) => Math.min(1, 1.001 - 2 ** (-10 * t)),
        smoothWheel: true,
      });
      let frame = requestAnimationFrame(function raf(time: number) {
        lenis.raf(time);
        frame = requestAnimationFrame(raf);
      });
      document.documentElement.classList.add("lenis");
      destroy = () => {
        cancelAnimationFrame(frame);
        lenis.destroy();
        document.documentElement.classList.remove("lenis");
      };
    });

    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [on, m.speed]);

  return null;
}

/**
 * Fades the page in on navigation. Deliberately opacity only: moving the whole
 * page on route change fights the browser's scroll restoration and reads as a
 * jump rather than a transition.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const m = useMotion();
  const pathname = usePathname();

  if (!m.ok || !m.pageTransition) return <>{children}</>;

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.26 / m.speed, ease: m.ease }}
      className="min-w-0"
    >
      {children}
    </motion.div>
  );
}

/** Shifts its child slightly against the scroll. */
export function Parallax({
  children,
  amount = 24,
  className,
}: {
  children: ReactNode;
  amount?: number;
  className?: string;
}) {
  const m = useMotion();
  const ref = useRef<HTMLDivElement>(null);
  const on = m.ok && m.parallax;

  useEffect(() => {
    const node = ref.current;
    if (!node || !on) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      const progress = (rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight;
      node.style.transform = `translate3d(0, ${(-progress * amount * m.intensity).toFixed(2)}px, 0)`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
      node.style.transform = "";
    };
  }, [on, amount, m.intensity]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/** Mounts the document-level motion features the theme has switched on. */
export function MotionRuntime() {
  return (
    <>
      <SmoothScroll />
      <Cursor />
    </>
  );
}

export { EASING_CURVES };
