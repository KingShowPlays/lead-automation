import { Lead } from "../../models/Lead.js";
import {
  PipelineJob,
  type PipelineJobDocument,
  type PipelineJobStatus,
  type PipelineJobType,
} from "../../models/PipelineJob.js";
import { PipelineLease } from "../../models/PipelineLease.js";
import { SearchRun, type SearchRunDocument } from "../../models/SearchRun.js";
import { logger } from "../../utils/logger.js";
import {
  discover,
  processPendingLeads,
  recoverableQueriesForRun,
  resumeDiscoveryRun,
  runFullPipeline,
  type BatchProcessResult,
  type DiscoverResult,
} from "./runPipeline.js";

export interface StartPipelineJobOptions {
  type: PipelineJobType;
  resumedFromRunId?: string;
}

function busyError(active?: PipelineJobDocument | null): Error {
  return Object.assign(
    new Error(
      active
        ? `Pipeline job ${String(active._id)} is already ${active.status.toLowerCase()}.`
        : "Another pipeline job is already active.",
    ),
    { statusCode: 409, activeJobId: active ? String(active._id) : undefined },
  );
}

async function updateJob(jobId: string, set: Record<string, unknown>): Promise<void> {
  await PipelineJob.updateOne(
    { _id: jobId, activeKey: "pipeline" },
    { $set: { ...set, heartbeatAt: new Date() } },
  );
}

function finalStatus(discovery?: DiscoverResult, processing?: BatchProcessResult): PipelineJobStatus {
  if (discovery?.status === "PARTIAL" || discovery?.status === "FAILED") return "PARTIAL";
  if (processing?.errors.length || processing?.aiFallbacks) return "PARTIAL";
  return "COMPLETED";
}

async function executePipelineJob(job: PipelineJobDocument): Promise<void> {
  const jobId = String(job._id);
  let discovery: DiscoverResult | undefined;
  let processing: BatchProcessResult | undefined;

  try {
    await updateJob(jobId, {
      status: "RUNNING",
      phase: job.type === "PROCESS" ? "PROCESSING" : "DISCOVERY",
      startedAt: new Date(),
      "progress.message": job.type === "PROCESS" ? "Checking discovered leads" : "Starting discovery",
    });

    const onDiscoveryProgress = async (progress: {
      runId: string;
      current: number;
      total: number;
      failed: number;
      found: number;
      created: number;
      query?: { city: string; category: string };
    }) => {
      await updateJob(jobId, {
        phase: "DISCOVERY",
        searchRunId: progress.runId,
        "progress.current": progress.current,
        "progress.total": progress.total,
        "progress.failedQueries": progress.failed,
        "progress.found": progress.found,
        "progress.created": progress.created,
        "progress.message": progress.query
          ? `Searching ${progress.query.category} in ${progress.query.city}`
          : "Running discovery",
      });
    };

    const onProcessingProgress = async (progress: {
      current: number;
      total: number;
      processed: number;
      qualified: number;
      errors: number;
      aiFallbacks: number;
    }) => {
      await updateJob(jobId, {
        phase: "PROCESSING",
        "progress.current": progress.current,
        "progress.total": progress.total,
        "progress.processed": progress.processed,
        "progress.qualified": progress.qualified,
        "progress.processingErrors": progress.errors,
        "progress.aiFallbacks": progress.aiFallbacks,
        "progress.message": "Checking websites, scoring leads and preparing pitches",
      });
    };

    if (job.type === "FULL") {
      const result = await runFullPipeline("API", { onDiscoveryProgress, onProcessingProgress });
      discovery = result;
      processing = result;
    } else if (job.type === "DISCOVERY") {
      discovery = await discover("API", undefined, { onProgress: onDiscoveryProgress });
    } else if (job.type === "PROCESS") {
      processing = await processPendingLeads(200, 50, { onProgress: onProcessingProgress });
    } else {
      if (!job.resumedFromRunId) throw new Error("A source discovery run is required to resume.");
      discovery = await resumeDiscoveryRun(String(job.resumedFromRunId), "API", onDiscoveryProgress);
      processing = await processPendingLeads(200, 50, { onProgress: onProcessingProgress });
    }

    const status = finalStatus(discovery, processing);
    await PipelineJob.updateOne(
      { _id: jobId },
      {
        $set: {
          status,
          phase: "COMPLETE",
          finishedAt: new Date(),
          heartbeatAt: new Date(),
          ...(discovery?.runId ? { searchRunId: discovery.runId } : {}),
          "progress.current": processing?.processed ?? discovery?.completedQueries ?? 0,
          "progress.total":
            processing
              ? processing.processed + processing.errors.length
              : discovery?.totalQueries ?? 0,
          "progress.found": discovery?.found ?? 0,
          "progress.created": discovery?.created ?? 0,
          "progress.failedQueries": discovery
            ? discovery.failedQueries + discovery.pendingQueries
            : 0,
          "progress.processed": processing?.processed ?? 0,
          "progress.qualified": processing?.qualified ?? 0,
          "progress.processingErrors": processing?.errors.length ?? 0,
          "progress.aiFallbacks": processing?.aiFallbacks ?? 0,
          "progress.message":
            status === "COMPLETED"
              ? "Pipeline completed"
              : "Completed with recoverable errors",
        },
        $unset: { activeKey: 1 },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message, jobId, type: job.type }, "background pipeline job failed");
    await PipelineJob.updateOne(
      { _id: jobId },
      {
        $set: {
          status: "FAILED",
          phase: "COMPLETE",
          error: message,
          finishedAt: new Date(),
          heartbeatAt: new Date(),
          "progress.message": message,
        },
        $unset: { activeKey: 1 },
      },
    ).catch(() => undefined);
  }
}

export async function startPipelineJob(options: StartPipelineJobOptions): Promise<PipelineJobDocument> {
  await PipelineJob.init();
  if (options.type === "RESUME_DISCOVERY" && !options.resumedFromRunId) {
    throw Object.assign(new Error("resumedFromRunId is required."), { statusCode: 400 });
  }
  if (options.type === "RESUME_DISCOVERY") {
    let run: SearchRunDocument | null = null;
    try {
      run = await SearchRun.findById(options.resumedFromRunId);
    } catch {
      // Invalid ObjectIds and missing runs intentionally share one response.
    }
    if (!run) throw Object.assign(new Error("Discovery run not found."), { statusCode: 404 });
    if (run.resumedBy) {
      throw Object.assign(new Error("This discovery run has already been resumed."), { statusCode: 409 });
    }
    if (recoverableQueriesForRun(run).length === 0) {
      throw Object.assign(new Error("This discovery run has no failed or incomplete queries to resume."), {
        statusCode: 409,
      });
    }
  }

  let job: PipelineJobDocument;
  try {
    job = await PipelineJob.create({
      type: options.type,
      trigger: "API",
      status: "QUEUED",
      phase: "QUEUED",
      activeKey: "pipeline",
      resumedFromRunId: options.resumedFromRunId,
      heartbeatAt: new Date(),
      progress: { message: "Queued" },
    });
  } catch (err) {
    if ((err as { code?: number })?.code !== 11000) throw err;
    const active = await PipelineJob.findOne({ activeKey: "pipeline" });
    throw busyError(active);
  }

  setImmediate(() => void executePipelineJob(job));
  return job;
}

export async function getPipelineJob(jobId: string): Promise<PipelineJobDocument | null> {
  try {
    return await PipelineJob.findById(jobId);
  } catch {
    return null;
  }
}

export async function getPipelineOperationalStatus(): Promise<{
  activeJob: PipelineJobDocument | null;
  latestJob: PipelineJobDocument | null;
  discoveredPending: number;
  resumableRun: { runId: string; status: string; recoverableQueries: number; startedAt: Date } | null;
}> {
  // A run that failed weeks ago is not pending work. The right answer then is a
  // fresh scan, which will find those businesses anyway, so offering "resume"
  // forever puts a call to action on screen for something nobody should do.
  const RESUMABLE_WINDOW_DAYS = 7;
  const resumableSince = new Date(Date.now() - RESUMABLE_WINDOW_DAYS * 86_400_000);

  const [activeJob, latestJob, discoveredPending, candidates] = await Promise.all([
    PipelineJob.findOne({ activeKey: "pipeline" }).sort({ createdAt: -1 }),
    PipelineJob.findOne().sort({ createdAt: -1 }),
    // Leads that have already failed processing repeatedly are not work this
    // button can finish. Counting them left "Process N discovered" on screen
    // permanently, doing nothing each time it was pressed.
    Lead.countDocuments({
      pipelineStage: "DISCOVERED",
      optedOut: { $ne: true },
      $or: [{ processingAttempts: { $exists: false } }, { processingAttempts: { $lt: 3 } }],
    }),
    SearchRun.find({
      resumedBy: { $exists: false },
      startedAt: { $gte: resumableSince },
      $or: [
        { status: { $in: ["PARTIAL", "FAILED"] } },
        { "queries.error": { $exists: true, $nin: [null, ""] } },
      ],
    })
      .sort({ startedAt: -1 })
      .limit(10),
  ]);

  let resumableRun: {
    runId: string;
    status: string;
    recoverableQueries: number;
    startedAt: Date;
  } | null = null;
  for (const run of candidates) {
    const recoverableQueries = recoverableQueriesForRun(run).length;
    if (recoverableQueries > 0) {
      resumableRun = {
        runId: String(run._id),
        status: run.status,
        recoverableQueries,
        startedAt: run.startedAt,
      };
      break;
    }
  }

  return { activeJob, latestJob, discoveredPending, resumableRun };
}

/**
 * A restarted process cannot still be executing its in-memory jobs. Convert
 * persisted RUNNING work to recoverable state and release stale leases.
 */
export async function recoverInterruptedPipelineWork(): Promise<void> {
  const now = new Date();
  await Promise.all([
    PipelineJob.updateMany(
      { activeKey: "pipeline" },
      {
        $set: {
          status: "FAILED",
          phase: "COMPLETE",
          finishedAt: now,
          heartbeatAt: now,
          error: "Interrupted by a service restart. Resume the scan or process discovered leads.",
          "progress.message": "Interrupted by a service restart",
        },
        $unset: { activeKey: 1 },
      },
    ),
    PipelineLease.deleteMany({}),
  ]);

  const interruptedRuns: SearchRunDocument[] = await SearchRun.find({ status: "RUNNING" });
  for (const run of interruptedRuns) {
    const total = run.progress?.totalQueries || run.plannedQueries?.length || run.queries.length;
    const completed = run.queries.length;
    const failed = run.queries.filter((query) => Boolean(query.error)).length;
    run.progress = {
      totalQueries: total,
      completedQueries: completed,
      successfulQueries: completed - failed,
      failedQueries: failed,
      pendingQueries: Math.max(0, total - completed),
    };
    run.status = "PARTIAL";
    run.finishedAt = now;
    run.heartbeatAt = now;
    run.error = "Interrupted by a service restart. Failed and incomplete queries can be resumed.";
    await run.save();
  }
}
