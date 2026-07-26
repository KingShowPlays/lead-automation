import { sleep } from "./async.js";

/**
 * Serial, adaptive request gate shared by every caller of one external API.
 * A rate-limit response halves the effective pace; sustained successes
 * gradually restore it to the configured ceiling.
 */
export class AdaptiveRateLimiter {
  private nextRequestAt = 0;
  private blockedUntil = 0;
  private tail: Promise<void> = Promise.resolve();
  private multiplier = 1;
  private successesSinceLimit = 0;

  constructor(
    private readonly now: () => number = Date.now,
    private readonly sleepImpl: (ms: number) => Promise<void> = sleep,
    private readonly minMultiplier = 0.25,
    private readonly recoveryEvery = 30,
  ) {}

  effectiveRequestsPerMinute(configuredRequestsPerMinute: number): number {
    const configured = Math.max(1, Math.floor(configuredRequestsPerMinute));
    return Math.max(1, Math.floor(configured * this.multiplier));
  }

  async waitTurn(requestsPerMinute: number): Promise<void> {
    let release!: () => void;
    const previous = this.tail;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;

    try {
      const effectiveRpm = this.effectiveRequestsPerMinute(requestsPerMinute);
      const intervalMs = Math.ceil(60_000 / effectiveRpm);
      const waitUntil = Math.max(this.nextRequestAt, this.blockedUntil);
      const delay = Math.max(0, waitUntil - this.now());
      if (delay > 0) await this.sleepImpl(delay);
      this.nextRequestAt = Math.max(this.now(), waitUntil) + intervalMs;
    } finally {
      release();
    }
  }

  blockFor(ms: number): void {
    this.blockedUntil = Math.max(this.blockedUntil, this.now() + Math.max(0, ms));
    this.multiplier = Math.max(this.minMultiplier, this.multiplier / 2);
    this.successesSinceLimit = 0;
  }

  /**
   * Clears only the active cooldown after an explicit health probe succeeds.
   * The reduced adaptive pace is preserved and must still recover gradually.
   */
  clearCooldown(): void {
    this.blockedUntil = 0;
    this.nextRequestAt = Math.min(this.nextRequestAt, this.now());
  }

  recordSuccess(): void {
    if (this.multiplier >= 1) return;
    this.successesSinceLimit += 1;
    if (this.successesSinceLimit < this.recoveryEvery) return;
    this.multiplier = Math.min(1, this.multiplier + 0.1);
    this.successesSinceLimit = 0;
  }
}

/** Parses Retry-After in either seconds or HTTP-date form. */
export function parseRetryAfterMs(headers: Headers, now = Date.now()): number | null {
  const raw = headers.get("retry-after")?.trim();
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(raw);
  return Number.isFinite(date) ? Math.max(0, date - now) : null;
}
