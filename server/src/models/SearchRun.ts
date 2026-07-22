import mongoose, { Schema, type Document, type Model } from "mongoose";

/** A record of one discovery run: which queries ran and what they yielded. */
export interface SearchRunDocument extends Document {
  trigger: "CRON" | "MANUAL" | "API";
  status: "RUNNING" | "COMPLETED" | "FAILED";
  startedAt: Date;
  finishedAt?: Date;
  queries: Array<{
    query: string;
    city: string;
    category: string;
    found: number;
    created: number;
    duplicates: number;
    suppressed: number;
    error?: string;
  }>;
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
    status: { type: String, enum: ["RUNNING", "COMPLETED", "FAILED"], default: "RUNNING" },
    startedAt: { type: Date, default: Date.now },
    finishedAt: Date,
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
