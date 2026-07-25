import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface PipelineLeaseDocument extends Document<string> {
  _id: "discovery" | "processing";
  owner: string;
  expiresAt: Date;
  updatedAt: Date;
}

const pipelineLeaseSchema = new Schema<PipelineLeaseDocument>(
  {
    _id: { type: String, required: true },
    owner: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

export const PipelineLease: Model<PipelineLeaseDocument> =
  (mongoose.models.PipelineLease as Model<PipelineLeaseDocument>) ??
  mongoose.model<PipelineLeaseDocument>("PipelineLease", pipelineLeaseSchema);
