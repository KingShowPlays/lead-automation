import mongoose, { Schema, type Document, type Model } from "mongoose";

export type SearchRunStatus = "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED";

export interface SearchQueryPlan {
  query: string;
  city: string;
  category: string;
}

export interface SearchQueryResult extends SearchQueryPlan {
  found: number;
  created: number;
  duplicates: number;
  suppressed: number;
  error?: string;
}

/** A record of one discovery run: which queries ran and what they yielded. */
export interface SearchRunDocument extends Document {
  trigger: "CRON" | "MANUAL" | "API";
  status: SearchRunStatus;
  startedAt: Date;
  finishedAt?: Date;
  heartbeatAt: Date;
  plannedQueries: SearchQueryPlan[];
  queries: SearchQueryResult[];
  resumedFrom?: mongoose.Types.ObjectId;
  resumedBy?: mongoose.Types.ObjectId;
  progress: {
    totalQueries: number;
    completedQueries: number;
    successfulQueries: number;
    failedQueries: number;
    pendingQueries: number;
  };
  totals: {
    found: number;
    created: number;
    duplicates: number;
    suppressed: number;
    processed: number;
    qualified: number;
  };
  error?: string;
}

const searchRunSchema = new Schema<SearchRunDocument>(
  {
    trigger: { type: String, enum: ["CRON", "MANUAL", "API"], default: "MANUAL" },
    status: { type: String, enum: ["RUNNING", "COMPLETED", "PARTIAL", "FAILED"], default: "RUNNING" },
    startedAt: { type: Date, default: Date.now },
    finishedAt: Date,
    heartbeatAt: { type: Date, default: Date.now },
    plannedQueries: {
      type: [
        {
          query: String,
          city: String,
          category: String,
          _id: false,
        },
      ],
      default: [],
    },
    queries: {
      type: [
        {
          query: String,
          city: String,
          category: String,
          found: Number,
          created: Number,
          duplicates: Number,
          suppressed: Number,
          error: String,
          _id: false,
        },
      ],
      default: [],
    },
    resumedFrom: { type: Schema.Types.ObjectId, ref: "SearchRun" },
    resumedBy: { type: Schema.Types.ObjectId, ref: "SearchRun" },
    progress: {
      totalQueries: { type: Number, default: 0 },
      completedQueries: { type: Number, default: 0 },
      successfulQueries: { type: Number, default: 0 },
      failedQueries: { type: Number, default: 0 },
      pendingQueries: { type: Number, default: 0 },
    },
    totals: {
      found: { type: Number, default: 0 },
      created: { type: Number, default: 0 },
      duplicates: { type: Number, default: 0 },
      suppressed: { type: Number, default: 0 },
      processed: { type: Number, default: 0 },
      qualified: { type: Number, default: 0 },
    },
    error: String,
  },
  { timestamps: true },
);

searchRunSchema.index({ startedAt: -1 });

export const SearchRun: Model<SearchRunDocument> =
  (mongoose.models.SearchRun as Model<SearchRunDocument>) ??
  mongoose.model<SearchRunDocument>("SearchRun", searchRunSchema);
