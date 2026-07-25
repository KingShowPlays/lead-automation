import { randomUUID } from "node:crypto";
import { PipelineLease } from "../../models/PipelineLease.js";

export type PipelineLeaseName = "discovery" | "processing";

export class PipelineBusyError extends Error {
  readonly statusCode = 409;

  constructor(public readonly lease: PipelineLeaseName) {
    super(
      lease === "discovery"
        ? "A discovery scan is already running. Wait for it to finish before starting another."
        : "Lead processing is already running. Track the active job instead of starting another.",
    );
    this.name = "PipelineBusyError";
  }
}

const LEASE_MS = 120_000;
const HEARTBEAT_MS = 30_000;

async function acquireLease(name: PipelineLeaseName, owner: string): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LEASE_MS);
  try {
    const lease = await PipelineLease.findOneAndUpdate(
      {
        _id: name,
        $or: [{ expiresAt: { $lte: now } }, { owner }],
      },
      { $set: { owner, expiresAt } },
      { upsert: true, new: true },
    );
    return lease.owner === owner;
  } catch (err) {
    // Two contenders can both take the upsert path before the unique _id is
    // visible. The duplicate-key loser is simply "busy".
    if ((err as { code?: number })?.code === 11000) return false;
    throw err;
  }
}

/** Cross-request/process lease used by API, background jobs and cron alike. */
export async function withPipelineLease<T>(name: PipelineLeaseName, work: () => Promise<T>): Promise<T> {
  const owner = randomUUID();
  if (!(await acquireLease(name, owner))) throw new PipelineBusyError(name);

  const heartbeat = setInterval(() => {
    const expiresAt = new Date(Date.now() + LEASE_MS);
    void PipelineLease.updateOne({ _id: name, owner }, { $set: { expiresAt } }).catch(() => undefined);
  }, HEARTBEAT_MS);
  heartbeat.unref();

  try {
    return await work();
  } finally {
    clearInterval(heartbeat);
    await PipelineLease.deleteOne({ _id: name, owner }).catch(() => undefined);
  }
}
