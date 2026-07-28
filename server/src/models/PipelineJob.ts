import mongoose, { Schema, type Document, type Model } from "mongoose";

export type PipelineJobType = "FULL" | "DISCOVERY" | "PROCESS" | "RESUME_DISCOVERY";
export type PipelineJobStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED";
export type PipelineJobPhase = "QUEUED" | "DISCOVERY" | "PROCESSING" | "COMPLETE";

export interface PipelineJobDocument extends Document {
  type: PipelineJobType;
  trigger: "CRON" | "MANUAL" | "API";
  status: PipelineJobStatus;
  phase: PipelineJobPhase;
  /** Present only while active. A sparse unique index prevents duplicate jobs. */
  activeKey?: "pipeline";
  searchRunId?: mongoose.Types.ObjectId;
  resumedFromRunId?: mongoose.Types.ObjectId;
  startedAt?: Date;
  finishedAt?: Date;
  heartbeatAt: Date;
  progress: {
    current: number;
    total: number;
    message: string;
    found: number;
    created: number;
    failedQueries: number;
    processed: number;
    qualified: number;
    processingErrors: number;
    aiFallbacks: number;
  };
  error?: string;
  /**
   * When the operator dismissed the report of this run.
   *
   * A run that ended badly keeps saying so on the overview, which is right
   * until it has been read. Without this there was no way to put it down: the
   * warning stayed until some later run happened to replace it.
   */
  acknowledgedAt?: Date;
}

const pipelineJobSchema = new Schema<PipelineJobDocument>(
  {
    type: {
      type: String,
      enum: ["FULL", "DISCOVERY", "PROCESS", "RESUME_DISCOVERY"],
      required: true,
    },
    trigger: { type: String, enum: ["CRON", "MANUAL", "API"], default: "API" },
    status: {
      type: String,
      enum: ["QUEUED", "RUNNING", "COMPLETED", "PARTIAL", "FAILED"],
      default: "QUEUED",
      index: true,
    },
    phase: {
      type: String,
      enum: ["QUEUED", "DISCOVERY", "PROCESSING", "COMPLETE"],
      default: "QUEUED",
    },
    activeKey: { type: String, enum: ["pipeline"] },
    searchRunId: { type: Schema.Types.ObjectId, ref: "SearchRun" },
    resumedFromRunId: { type: Schema.Types.ObjectId, ref: "SearchRun" },
    startedAt: Date,
    finishedAt: Date,
    heartbeatAt: { type: Date, default: Date.now },
    progress: {
      current: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      message: { type: String, default: "Queued" },
      found: { type: Number, default: 0 },
      created: { type: Number, default: 0 },
      failedQueries: { type: Number, default: 0 },
      processed: { type: Number, default: 0 },
      qualified: { type: Number, default: 0 },
      processingErrors: { type: Number, default: 0 },
      aiFallbacks: { type: Number, default: 0 },
    },
    error: String,
    acknowledgedAt: Date,
  },
  { timestamps: true },
);

pipelineJobSchema.index({ activeKey: 1 }, { unique: true, sparse: true });
pipelineJobSchema.index({ createdAt: -1 });

export const PipelineJob: Model<PipelineJobDocument> =
  (mongoose.models.PipelineJob as Model<PipelineJobDocument>) ??
  mongoose.model<PipelineJobDocument>("PipelineJob", pipelineJobSchema);
